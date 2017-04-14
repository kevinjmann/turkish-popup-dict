//content.js
var mouseX=0;
var mouseY = 0;

document.addEventListener('mousemove', function(e) {
    mouseX = e.pageX;
    mouseY = e.pageY+10;
});

f=function(){
   var toSend = window.getSelection().toString().trim();
   chrome.runtime.sendMessage({"message":"parse_this_text", "text":toSend},
   function(response){
       renderBubble(mouseX,mouseY,response.message);
   });
}
//show lemmas, morphological analyses, and defs on double click
//only works on pages in .tr domain
var bubbleDOM = document.createElement('div');
bubbleDOM.setAttribute('class', 'selection_bubble');
window.onload=function(){
    document.body.addEventListener('dblclick',f);
    document.body.appendChild(bubbleDOM);
}




// Close the bubble when we click on the screen.
document.addEventListener('mousedown', function (e) {
  bubbleDOM.style.visibility = 'hidden';
}, false);

// Move that bubble to the appropriate location.
function renderBubble(mouseX, mouseY, selection) {
  bubbleDOM.innerHTML = selection;
  bubbleDOM.style.top = mouseY + 'px';
  bubbleDOM.style.left = mouseX + 'px';
  bubbleDOM.style.visibility = 'visible';
}


