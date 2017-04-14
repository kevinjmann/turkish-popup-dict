//background.js
//contains code for the background tasks:
//reading in automaton file,
//creating summary.

/*-------------------Read automaton file-----------------------------*/
var automatonText="";
function readTextFile(file)
{
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                var allText = rawFile.responseText;
                automatonText = rawFile.responseText;
            }
        }
    }
    rawFile.send(null);
}
var dictText = "";
function readDictTextFile(file)
{
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                var allText = rawFile.responseText;
                dictText = rawFile.responseText;
            }
        }
    }
    rawFile.send(null);
}
var automaton = {};
readTextFile("trmorph.att");
readDictTextFile("turkishDictWithRoots.txt");
var turkDict={};
var dictLines = dictText.split("\n");
var dictLinLen = dictLines.length;
for(i=0;i<dictLinLen;i++){
    var lineSplit = dictLines[i].split("\t");
    var engdef = lineSplit[0];
    var turkWord = lineSplit[1];
    var pos = lineSplit[2];
    if(turkDict[turkWord]==undefined){
        turkDict[turkWord]=new Array();
    }
    turkDict[turkWord].push(engdef+" - "+pos);
}

var atLines = automatonText.split("\n");
var atLinLen = atLines.length;
var finalStateSparse = [];
for(i=0; i<atLinLen; i++){
    var curLine = atLines[i].split("\t");
    var curState = curLine[0];
    if(curLine.length==1){
        finalStateSparse.push(curState);
    }   
    if(automaton[curState]==null){
        automaton[curState]={};
    }
    var curSlice = curLine.slice(1);
    if(curSlice.length!=0){
        
        var s2 = curSlice[0];
        var oa= curSlice[1];
        var ia = curSlice[2];
        if(automaton[curState][ia]==null){
            automaton[curState][ia]=new Array();
        }
        automaton[curState][ia].push([s2, oa]);
    }
}

var finalStates = new Array(Object.keys(automaton).length);
for(k=0; k<finalStates.length; k++){ //initialize all final states to falses
    finalStates[k]=false;
}
for(k=0; k<finalStateSparse.length;k++){ //set final states
    finalStates[finalStateSparse[k]]=true;
}


function parse(aText){
    var hypothesisStack = [];
    var output= [];
    hypothesisStack.push(["",0,0]); //initialize stack
    while(hypothesisStack.length>0){
        var popped = hypothesisStack.pop();
        var curText = popped[0];
        var curChar = aText[popped[1]];
        var curTextInd = popped[1];
        var curState = popped[2];
        if(curTextInd==aText.length&&finalStates[curState]){
            output.push(popped);
        }
        var nonEpsTrans=automaton[curState][curChar];
        if(nonEpsTrans!=undefined){
            for(i=0;i<nonEpsTrans.length;i++){
                var transition = nonEpsTrans[i];
                var newState=transition[0];
                var oa = transition[1];
                hypothesisStack.push([curText+oa, curTextInd+1, newState]);
            }
        }
        var epsTrans=automaton[curState]['@0@'];
        if(epsTrans!=undefined){
            for(i=0;i<epsTrans.length;i++){
                var transition=epsTrans[i];
                var newState=transition[0];
                var oa= transition[1];
                hypothesisStack.push([curText+oa,curTextInd,newState]);
            }
       }
    }
    return output;

}
var roots = []; 
var textToPrint="";
function getRoots(result){
    var toReturn = new Array();
    for(i=0; i<result.length; i++){
        toReturn.push(result[i][0]);
    }
    return toReturn;
}
var allRoots = uniq(roots);
function uniq(a) {
   return Array.from(new Set(a));
}
var tmpText='';
for(i=0;i<allRoots.length;i++){
    tmpText+=allRoots[i];
}

chrome.runtime.onMessage.addListener( 
    function(request, sender, sendResponse) {
        if( request.message==="parse_this_text") {
            var parseSelected = parse(request.text);
            if(parseSelected==undefined){
                parseSelected="";
            } else {
                toPrint = '';
                //collect parses by root
                var rootsToParses = {};
                for(i in parseSelected){
                    var root = parseSelected[i][0].split('<')[0]; 
                    var aParse = parseSelected[i][0].substring(root.length);
                    if(rootsToParses[root]==undefined){
                        rootsToParses[root]=[];
                    }
                    rootsToParses[root].push(aParse);
                }
                var roots = Object.keys(rootsToParses);
                for (rootInd in roots){
                    var curRoot = roots[rootInd];
                    toPrint+="<span style=\"color: #76323f; display: inline-block;"
                    +" padding: 3px 10px; font-weight: bold; border-radius: 5px;\">"
                    +curRoot+"</span>:\n<span style=\"color: #000; display: inline-block;"
                    +" padding: 3px 10px; font-weight: bold; border-radius: 5px;\">"+turkDict[curRoot]+"</span>\n";
                }
                sendResponse({message:toPrint});
                // chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
                //     chrome.tabs.sendMessage(tabs[0].id, {"message": "parsed_text", "text":toPrint}, function(response) {});  
                // });

            }
        }
    }
)



/*-------------------Create summary----------------------------*/


var InvInd = {}; //contains term->sents mapping 
var termIds = {}; //contains unique ids for terms in article 
var sentToTerms = []; //contains sent->terms for getting doc norms 
var sentNorms = []; //contains sent tf-idf norms
var completeSentences = []; //contains the sentences of the text to be summarized
var summary = ''; //summary to be printed



// Set up context menu at install time. Works on all URLs.
chrome.runtime.onInstalled.addListener(function() {
  var context = "selection";
  var title = "Make a summary from this text"; //"Make a quiz from this text";
  var id = chrome.contextMenus.create({"title": title, "contexts":[context],
                                         "id": "context" + context});  
});
// add click event
chrome.contextMenus.onClicked.addListener(onClickHandler);


// The onClicked callback function.
function onClickHandler(info, tab) {
    var sText = info.selectionText.toString(); //note: info.selectionText() doesn't 
                                               //have white space characters like \n or \t
    
    // reset global variables
    InvInd = {};
    termIds = {};
    sentToTerms = [];
    sentNorms = [];
    completeSentences=[];
    summary = [];
    sentences = sText.split(/[.?!]/); //simple sentence tokenizer
    for(i in sentences){
        var curSent = sentences[i];
        if(curSent.indexOf('\n')==-1&&curSent.length>0){
            completeSentences.push(curSent);
        }
    }
    
    createInvInd(completeSentences);
    calculateDocNorms(completeSentences);
    kmeansAndSummarize(completeSentences.length/4, sentences);

    var summaryPopup=window.open('', '', 'width=350, height=250');
    summaryPopup.document.open().write(summary);
    summaryPopup.document.title="Summary";
  
};

//function to parse multiple words
function lemmatizeWords(listOfWords){
    var toReturn = [];
    var wordInd;
    var toAlert = "";
    for (wordInd in listOfWords){
        var curWord = listOfWords[wordInd].replace(/[\s.,\/#!$%\^&\*;:{}=\-_`~()\"\’]/g,"");
        if(curWord==""){
            continue;
        }
        var parsedWord = parse(curWord);
        if(parsedWord[0]===undefined){ //words not in dictionary
            if(curWord.length>0)
            {
                var lemma=curWord;
                var pos = "unknown";
                var lemPos=[lemma, pos];
                // alert("lemmatization error");
                toReturn.push(lemPos);
            }
        }
        else {
            var lemma = parsedWord[0][0].split('<')[0];
            var pos = parsedWord[0][0].split('<')[1].slice(0,-1);
            var lemPos = [lemma, pos];
            toReturn.push(lemPos);
        }

    }
    return toReturn;
   
}

function createInvInd(sentences){
    var sentInd;
    var wordInd;
    for(sentInd in sentences){
        // alert(sentences[sentInd]);
        var curSentSplit = sentences[sentInd].split(/\s/);
        // alert(curSentSplit);
        var lemmasWithPos = lemmatizeWords(curSentSplit);
        // alert(lemmasWithPos);
        var sentFeats = []; //var to hold tf for each term in a sentence
        for(wordInd in lemmasWithPos){
            var curWord = lemmasWithPos[wordInd][0];
            var curPos = lemmasWithPos[wordInd][1];
            if(InvInd[curWord]==null){
                InvInd[curWord]=new Array(sentences.length).fill(0);
            }
            if(InvInd[curWord][sentInd]==null){
                InvInd[curWord][sentInd]=0;
            }
            InvInd[curWord][sentInd]+=1;
            if(termIds[curWord]==null){
                termIds[curWord]=Object.keys(termIds).length;
            }
            
        } 
    }
    
}


function calculateDocNorms(sentences){
    var wordKeys = Object.keys(InvInd);
    //initialize sentToTerms matrix (0s numTerms*numSents)
    for(i in sentences){
        sentToTerms.push(new Array(wordKeys.length).fill(0));
    }
    //initialize to have doc features
    for(wordInd in wordKeys){
        var curWord=wordKeys[wordInd];
        var curPostings=InvInd[curWord];
        var numNonZero=0;
        for(j in curPostings){
            if (curPostings[j]>0){
                numNonZero+=1;
            }
        }
        var curTermId=termIds[curWord];
        var curIdf = Math.log(sentences.length/numNonZero);
        for(sentInd in curPostings){
            sentToTerms[sentInd][curTermId]+=curPostings[sentInd]*curIdf;
        }
    }
    for(sentInd in sentToTerms){
        var curNorm = 0;
        var curSent = sentToTerms[sentInd];
        for(elemInd in curSent){
            curNorm+=curSent[elemInd]*curSent[elemInd]
        }
        curNorm = Math.sqrt(curNorm);
        sentNorms.push(curNorm); //store doc norm for each sentence
    }
    toPrint = "";
    for(i in sentToTerms){
        toPrint+=sentToTerms[i]+'\n';
    }
    // alert(toPrint);
   

    
}
//helper function for calculating cos sim between sentence vectors and centroids
function cosSimForCentroid(centVec, aSentVec, aSentNorm){
    var centNorm = 0;
    for(elemInd in centVec){
        centNorm+=centVec[elemInd]*centVec[elemInd];
    }
    centNorm=Math.sqrt(centNorm);
    var dotProd = 0;
    for(elemInd in aSentVec){
        dotProd+=aSentVec[elemInd]*centVec[elemInd];
    }
    var cosSim = dotProd/(centNorm*aSentNorm);
    return cosSim;
}

//get random integer in range [0, max)
function getRandomInt(max){
    return Math.floor(Math.random()*max);
}
//check if an array contains target
function contains(anArray, target)
{
    var count=anArray.length;
    for(var i=0;i<count;i++)
    {
        if(anArray[i]===target)
        {
            return true;
        }
    }
    return false;
}

//helper function for adding two vectors element wise
function addVectors(vec1, vec2){
    return vec1.map(function(e, i){
        return e+vec2[i];
    });
}
function kmeansAndSummarize(k, sentences){
    //get k unique random docvecs to initialize
    var initialDocInds = [];
    // alert("kmeans started")
    for(i=0; i<k; i++){
        // var possibleInd = genRandomInt(sentNorms.length);
        var maxInd = sentNorms.length;
        var possibleInd = getRandomInt(maxInd);
        //make sure the indices are unique
        while(contains(initialDocInds, possibleInd)){
            // var possibleInd = genRandomInt(sentNorms.length);
            var possibleInd=getRandomInt(maxInd);
        }
        initialDocInds.push(possibleInd);
    }
    // alert("makes it through first loop")
    var centroids = []
    for(i in initialDocInds){
        centroids.push(sentToTerms[initialDocInds[i]]);
    }
    // alert("makes it through second loop")
    var assignments = new Array(sentToTerms.length);
    var vocabSize = Object.keys(InvInd).length;
    var numKMeansIter = 9;
    //do 8 iterations of kmeans
    for(i=0;i<numKMeansIter;i++){
        //store num vecs assigned to each centroid
        var numVecsForCentroids = new Array(sentToTerms.length).fill(0);
        //store running sum of vectors for each centroid
        var sumVecsForCentroids = new Array(sentToTerms.length)
        for(j=0;j<sentToTerms.length;j++){
            sumVecsForCentroids[j]=new Array(vocabSize).fill(0);
        }
        //assign doc to centroids
        for(sInd in sentToTerms){
            var curSent = sentToTerms[sInd];
            var possAssignment = 0;
            var curBestCosSim = 0;
            for(cInd in centroids){
                var curC = centroids[cInd];
                var curCosSim = cosSimForCentroid(curC, curSent, sentNorms[sInd]);
                if(curCosSim>curBestCosSim){
                    curBestCosSim=curCosSim;
                    possAssignment=cInd;
                }
            }
            assignments[sInd] = possAssignment;
            numVecsForCentroids[possAssignment]+=1;
            sumVecsForCentroids[possAssignment]=addVectors(
                sumVecsForCentroids[possAssignment], sentToTerms[sInd]
            );
        }
        // alert(i);
        //update centroids
        if(i!=numKMeansIter-1){//don't update centroids on last iteration
            for(cInd in centroids){
                
                var curCentSum = sumVecsForCentroids[cInd];
                // alert("length of curCentSum "+ curCentSum.length);
                var curNumVecsForCentroid = numVecsForCentroids[cInd];
                // alert(curNumVecsForCentroid);
                
                for(elemInd in curCentSum){
                    // alert("curCentSum: "+curCentSum[elemInd]);
                    curCentSum[elemInd]=curCentSum[elemInd]/curNumVecsForCentroid;
                }
                centroids[cInd]=curCentSum;
            }
        }else {
            
        }
    }
    getSummary(sentences, assignments, centroids);
}
//creates summary from sentences with vectors closest to centroids
function getSummary(sentences, assignmentVecs, centroidVecs){
    var curBestForClusterInd = new Array(centroidVecs.length).fill(0); //current index corresponding to highest cossim for cluster
    var curBestForClusterScore = new Array(centroidVecs.length); //current highest cossim for member of cluster
    for(i=0; i<centroidVecs.length;i++){ //initialize best scores for each cluster to 0 vectors
        curBestForClusterScore[i]=new Array(Object.keys(InvInd)).fill(0);
    }

    for(sInd in sentToTerms){
        var curSent=sentToTerms[sInd];
        var curSentNorm = sentNorms[sInd];
        var curCentroidInd = assignmentVecs[sInd];
        var curCentroid = centroidVecs[curCentroidInd];
        var curCosSim = cosSimForCentroid(curCentroid, curSent, curSentNorm);
        if(curCosSim>curBestForClusterScore[curCentroidInd]){
            curBestForClusterInd[curCentroidInd]=sInd;
            curBestForClusterScore[curCentroidInd]=curCosSim;
        }
    }
    //retain the chronological order of the sentences
    var summarySentInds = curBestForClusterInd.sort();
    var toPrint = "";
    for(i in summarySentInds){
        toPrint+=sentences[summarySentInds[i]]+".\n";
    }
    summary = toPrint;
    //alert(toPrint);
}

