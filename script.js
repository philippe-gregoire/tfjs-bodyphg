/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

/********************************************************************
 * Real-Time-Person-Removal Created by Jason Mayes 2020.
 *
 * Get latest code on my Github:
 * https://github.com/jasonmayes/Real-Time-Person-Removal
 *
 * Got questions? Reach out to me on social:
 * Twitter: @jason_mayes
 * LinkedIn: https://www.linkedin.com/in/creativetech
 ********************************************************************/

const video = document.getElementById('webcam');

const DEBUG = false;

const canvasCellIDs=['ghost','color','test']
const canvasCells={}

const bodyPartColors={}

// An object to configure parameters to set for the bodypix model.
// See github docs for explanations.
const bodyPixProperties = {
  architecture: 'MobileNetV1',
  outputStride: 16,
  multiplier: 0.75,
  quantBytes: 4
};

// An object to configure parameters for detection. I have raised
// the segmentation threshold to 90% confidence to reduce the
// number of false positives.
const segmentationProperties = {
  flipHorizontal: false,
  internalResolution: 'high',
  segmentationThreshold: 0.9,
  scoreThreshold: 0.2
};

// Keep the latest image with non-body pixels
// The image is updated with all non-body pixels.
var latestNonBodyImage = null;

// Trackmouse
var mouseX;
var mouseY;
document.onmousemove = function(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
}

// Render returned segmentation data to a given canvas context.
function processSegmentation(videoCanvas,segmentation) {
  const w=videoCanvas.width;
  const h=videoCanvas.height;
  
  var videoCtx = videoCanvas.getContext('2d');
  
  // If there is no non-body image, create one. It will be initialized at all black
  if(! latestNonBodyImage) {
    latestNonBodyImage=new ImageData(w,h)
  }
  const nonBodyBuf=latestNonBodyImage.data
  
  // Rebuild color image data
  const colorImageData=new ImageData(w,h)
  const colorBuf=colorImageData.data
  
  // Keep only body image data
  const bodyImageData=new ImageData(w,h)
  const bodyBuf=bodyImageData.data
  
  // Get data from our overlay canvas which is attempting to estimate background.
  const videoImageData = videoCtx.getImageData(0, 0, w,h)
  const videoBuf = videoImageData.data;
  
  const testCtx = canvasCells.test.getContext("2d");
  const imgBeach = document.getElementById("beach");
  testCtx.drawImage(imgBeach,0,0,w,h);
  
  const textBuf=testCtx.getImageData(0, 0, w,h)
  
  testCtx.drawImage(imgBeach,0,0,w,h);
     
  // Init bounding box to full image
  var minX = w-1;
  var minY = h-1;
  var maxX = 0;
  var maxY = 0;
  
  var foundBody = false;
  
  // Go through pixels and figure out bounding box of body pixels.
  let nUp=0;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const n = y * w + x;
      const n4=n*4
      
      const bodyPart=segmentation.data[n]
      if (bodyPart !== 0) {
        // Body part pixel found. Update bounds.
        foundBody = true;
        if(x < minX) minX = x
        if(x > maxX) maxX = x
        if(y < minY) minY = y
        if(y > maxY) maxY = y;
        
        // This is a body pixel
        bodyBuf[n4]=videoBuf[n4]
        bodyBuf[n4+1]=videoBuf[n4+1]
        bodyBuf[n4+2]=videoBuf[n4+2]
        bodyBuf[n4+3]=videoBuf[n4+3]

        // Create color map
        colorBuf[n4]=videoBuf[n4]
        colorBuf[n4+1]=videoBuf[n4+1]
        colorBuf[n4+2]=videoBuf[n4+2]
        colorBuf[n4+3]=videoBuf[n4+3]
        
        // test overlay
        textBuf[n4]=videoBuf[n4]
        textBuf[n4+1]=videoBuf[n4+1]
        textBuf[n4+2]=videoBuf[n4+2]
        textBuf[n4+3]=videoBuf[n4+3]
        
      } else {
        // This is a non-body pixel
        nonBodyBuf[n4]=videoBuf[n4]
        nonBodyBuf[n4+1]=videoBuf[n4+1]
        nonBodyBuf[n4+2]=videoBuf[n4+2]
        nonBodyBuf[n4+3]=videoBuf[n4+3]
        nUp++
      }
    }
    //console.log("number of non-body pixels",nUp)
  }
  
  // Calculate dimensions of bounding box.
  const width = maxX - minX;
  const height = maxY - minY;
  
  // Define scale factor to use to allow for false negatives around this region.
  var scale = 1.3;

  //  Define scaled dimensions.
  const newWidth = width * scale;
  const newHeight = height * scale;

  // Caculate the offset to place new bounding box so scaled from center of current bounding box.
  const offsetX = (newWidth - width) / 2;
  const offsetY = (newHeight - height) / 2;

  const newXMin = minX - offsetX;
  const newYMin = minY - offsetY;
  
  const ghostCtx=canvasCells.ghost.getContext('2d')
  
  //.drawImage(video, 0, 0);
  ghostCtx.putImageData(latestNonBodyImage, 0, 0);
  
  function segValue(canvasElem,segArray) {
    const rect=canvasElem.getBoundingClientRect()
    const mX=mouseX-Math.floor(rect.left)
    const mY=mouseY-Math.floor(rect.top)
    const index=mX+mY*w
    
    if(index>=0 && index < segArray.length) {
      return [segArray[index],mX,mY]
    } else {
      return [null,mX,mY]
    }
  }
  
  if (document.getElementById("showbox").checked) {
    ghostCtx.strokeStyle = "green"
    ghostCtx.beginPath();
    ghostCtx.rect(newXMin, newYMin, newWidth, newHeight);
    ghostCtx.stroke();
    
    // Plot segmentation value if within image
    const segVals=segValue(canvasCells.ghost,segmentation.data)
    if(segVals[0]!==null) {
      ghostCtx.fillStyle = 'blue';
      ghostCtx.font = 'bold 24px sans-serif';
      ghostCtx.fillText(`${segVals[0]}`,segVals[1],segVals[2])
    }
  }

  // Print colorized body parts
  const colorCtx=canvasCells.color.getContext('2d')
  colorCtx.putImageData(bodyImageData, 0, 0);
  const segVals=segValue(canvasCells.color,segmentation.data)
  if(segVals[0]!==null) {
    colorCtx.fillStyle = 'red';
    colorCtx.font = 'bold 24px sans-serif';
    colorCtx.fillText(`${segVals[0]}`,segVals[1],segVals[2])
  }
  
  // Print person only in test area
  testCtx.putImageData(textBuf, 0, 0);
}


// Let's load the model with our parameters defined above.
// Before we can use bodypix class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
var modelHasLoaded = false;
var model = undefined;

model = bodyPix.load(bodyPixProperties).then(function (loadedModel) {
  model = loadedModel;
  modelHasLoaded = true;
  // Show demo section now model is ready to use.
  document.getElementById('demos').classList.remove('invisible');
});


/********************************************************************
// Continuously grab image from webcam stream and classify it.
********************************************************************/

var previousSegmentationComplete = true;

// Check if webcam access is supported.
function hasGetUserMedia() {
  return !!(navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia);
}


// This function will repeatidly call itself when the browser is ready to process
// the next frame from webcam.
function predictWebcam() {
  if (previousSegmentationComplete) {
    // Copy the video frame from webcam to a tempory canvas in memory only (not in the DOM).
    canvasCells['video'].getContext('2d').drawImage(video, 0, 0);
    previousSegmentationComplete = false;
    
    // Now classify the canvas image we have available.
    model.segmentPerson(canvasCells['video'], segmentationProperties).then(function(segmentation) {
      processSegmentation(canvasCells['video'],segmentation);
      previousSegmentationComplete = true;
    });
  }

  // Call this function again to keep predicting when the browser is ready.
  window.requestAnimationFrame(predictWebcam);
}


// Enable the live webcam view and start classification.
function enableCam(event) {
  if (!modelHasLoaded) {
    return;
  }
  
  // Hide the button through CSS style 'removed'
  event.target.classList.add('removed');  
  
  // getUsermedia parameters.
  const constraints = {
    video: true
  };

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    video.addEventListener('loadedmetadata', function() {
      // Update widths and heights once video is successfully played otherwise
      // it will have width and height of zero initially causing classification
      // to fail.
      for(var i in canvasCells) {
        canvasCells[i].width=video.videoWidth
        canvasCells[i].height=video.videoHeight
      }
    });
    
    video.srcObject = stream;
    
    video.addEventListener('loadeddata', predictWebcam);
  });
}


// We will create a tempory canvas to render to store frames from 
// the web cam stream for classification. This canvas is in-memory, not inserted in the DOM
canvasCells['video']=document.createElement('canvas')

// Lets create a set of canvases in the cell Ids to render our findings to the DOM.
for(const cellId of canvasCellIDs) {
  let canvas = document.createElement('canvas');
  canvas.setAttribute('class', 'overlay');
  console.log("cellId="+cellId)
  document.getElementById('body'+cellId).appendChild(canvas);
  canvasCells[cellId]=canvas
}

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  document.getElementById('webcamButton').addEventListener('click', enableCam);
} else {
  console.warn('getUserMedia() is not supported by your browser');
}