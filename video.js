
class Detector {
   constructor(color, debug) {
      this.color = hex2rgb(color);
      this.DEBUG = (debug) ? true : false;
      this.AddedChartSize = 255;
      this.iterations = 10;

      this.color_selector = document.getElementById('color-selector');
      this.color_selector_menu = document.createElement('input');
      this.color_selector_menu.type = "color";
      this.color_selector_menu.id = "selected-color";
      this.color_selector_menu.value = this.color;
      this.color_selector.appendChild(this.color_selector_menu);
      this.color_selector_menu.addEventListener("change", (event) => {
         this.color = hex2rgb(event.target.value);
         console.log("New color selected: ", this.color, RGB2HSV(this.color));
      });


      //Threshold
      this.threshold = document.createElement("input");
      this.threshold.type = "range";
      this.threshold.min= 0;
      this.threshold.max= 255;
      this.threshold.value = 30;
      this.thresh_select = document.getElementById("thresh-select");
      const header = document.createElement("h2");
      header.textContent = `Threshold Value = ${this.threshold.value}`
      this.threshold.addEventListener("input", (_) => {
         header.textContent = `Threshold Value = ${this.threshold.value}`
      })
      this.thresh_select.appendChild(header);
      this.thresh_select.appendChild(this.threshold);


      if (this.DEBUG) {
         this.dbgCanvas = document.createElement("canvas");
         this.dbgContext = this.dbgCanvas.getContext("2d", {willReadFrequently: true});
         document.body.appendChild(this.dbgCanvas);
      }
   }

   detect(image, pixelIndex) {
      const desired_points = [];
      if (pixelIndex) {
         this.color = getAverageColor(pixelIndex, image.data);
         const hsv = RGB2HSV(this.color);
         console.log(`HUE: ${hsv.h}, SATURATION: ${hsv.s}, VALUE: ${hsv.v}`);
      }
      const colorChoice = this.color;
      for (let i =0; i < image.data.length; i += 4) {
         const red = image.data[i + 0]; 
         const green = image.data[i + 1]; 
         const blue = image.data[i + 2]; 
         const curPixel = {r:red, g:green, b:blue};
         if (!pixelNearColorHSV(colorChoice, curPixel, parseInt(this.threshold.value))) continue;
         const pixelIndex = i/4;
         const x = pixelIndex % image.width;
         const y = Math.floor(pixelIndex / image.width);
         desired_points.push( {x, y, curPixel });
      }

      const centers = kMeans(2, desired_points, this.iterations, 0, image.width);


      if (this.DEBUG) {
         this.dbgCanvas.width = image.width;
         this.dbgCanvas.height = image.height + this.AddedChartSize ;
         for (const point of desired_points) {
            // this.dbgContext.globalAlpha = point.color_intensity / 255;
            this.dbgContext.globalAlpha = this.getAlpha(this.getColorDistance(colorChoice, point.curPixel), this.threshold.value);
            this.dbgContext.fillRect(point.x,point.y, 1,1);
      }
         // Chart
         const radius = (x) => Math.sqrt(x.group.length)/2;
         centers.forEach((p) => this.drawCenter(p.center, radius(p) ));
         this.dbgContext.globalAlpha = 1;
         // this.debugChart(desired_points);

      }

      return centers;

   }

   drawCenter(point, radius) {
      this.dbgContext.beginPath();
      this.dbgContext.arc(point.x, point.y, radius, 0, Math.PI * 2);
      this.dbgContext.lineWidth = 10;
      this.dbgContext.stroke();
   }

   debugChart(points) {
      this.dbgContext.translate(0,this.dbgCanvas.height);

      for (let i = 0; i < points.length; i++) {
         const y = -points[i].color_intensity;
         const x = this.dbgCanvas.width * i / points.length;
         this.dbgContext.fillRect(x,y,1,1);
      }

   }

   getColorDistance(curColor, pixelColor) {
      const deltaR = pixelColor.r - curColor.r;
      const deltaG = pixelColor.g - curColor.g;
      const deltaB = pixelColor.b - curColor.b;
      return Math.sqrt(deltaR * deltaR + deltaG * deltaG + deltaB * deltaB);
   }

   getAlpha(distance, threshold) {
      return 1 - Math.min(distance/threshold, 1);
   }

   updateColor(data, pixelIndex) {
      this.color = {r: data[pixelIndex], g: data[pixelIndex+1], b: data[pixelIndex+2]};
      console.log(`Updated color: ${this.color.r},${this.color.g},${this.color.b}`);
   }
}



const COLOR         = "#dfff00"; // YELLOW
const videoID       = document.createElement("video"); 
const canvasID      = document.getElementById("replication");
const canvasContext = canvasID.getContext("2d", {willReadFrequently: true});
const detector      = new Detector(COLOR, false);

var replacement_color = "#dfff00"; // YELLOW
var canvasPixelIndex = null;


const getDistance = (p1,p2) => Math.hypot(p1.x - p2.x, p1.y-p2.y);
const getDist2 = (p1,p2) =>  Math.pow(p1.x - p2.x,2) * Math.pow(p1.y-p2.y,2);

const getIndex = (point) => (Math.floor(point.y) * canvasID.width + Math.floor(point.x)) * 4;


const replacer = document.createElement("input");
const color_container = document.getElementById('color-replacer');
const replacer_header = document.createElement('h3');
replacer_header.textContent = "Choose replacement color:";
replacer.id = 'color-replacer';
replacer.type = 'color';
replacer.value = replacement_color;
color_container.appendChild(replacer_header);
color_container.appendChild(replacer);
replacer.addEventListener("change", (event) => {
   replacement_color = event.target.value;
})

canvasID.addEventListener("mousedown", (event) => {
   console.log(`x:${event.x}, y:${event.y}`);
   canvasPixelIndex = getSurroundingPixels({x:event.x, y:event.y}, canvasID.width, canvasID.height, 4);
   console.log(`Averaging ${canvasPixelIndex.length} Pixels`);

});


renderVideo(videoID, canvasID, canvasContext);



function renderVideo(videoID, canvasID, canvasContext) {
   navigator.mediaDevices.getUserMedia( {video: true})
      .then((rawVideoStream) => {
         videoID.srcObject = rawVideoStream;
         videoID.play();
         videoID.onloadeddata = () => {
            fixCanvasProperties(videoID,canvasID, canvasContext);
            loop(videoID,canvasID,canvasContext);
         };
      }).catch((error) => {
            alert(error);
      });
}




function fixCanvasProperties(videoID, canvasID ) {
   canvasID.width = videoID.videoWidth;
   canvasID.height = videoID.videoHeight;
}

function loop(videoID, canvasID, canvasContext) {
   canvasContext.drawImage(videoID, 0 ,0, canvasID.width, canvasID.height);
   const imageData = canvasContext.getImageData(0,0, canvasID.width, canvasID.height);
   const centers = detector.detect(imageData, canvasPixelIndex);
   if (centers && centers.length > 0) {
      canvasContext.fillStyle = replacement_color;
      for (const c of centers) {
         for (const point of c.group) {
            canvasContext.fillRect(point.x,point.y,1,1);
         }
      }
   }
   canvasPixelIndex = null;
   requestAnimationFrame( () => loop(videoID, canvasID, canvasContext));
};

function averagePoints(points) {
      const center = { x: 0, y: 0};
      for (const p of points) {
         center.x += p.x;
         center.y += p.y;
      }
      center.x /= points.length;
      center.y /= points.length;
      return center
   }
   

function getRandomInt(min, max, seed) {
   const bottomRange = Math.ceil(min);
   const topRange    = Math.ceil(max);
   return Math.floor(Math.random() * (topRange - bottomRange) + bottomRange) * (seed % topRange) + bottomRange;
}


// Kmeans implementation

function kMeans(k, data, iterations, windowMin, windowMax) {
   let centers = [];
   for (let i = 0; i < k; i++) {
      centers.push({'center': {x: getRandomInt(windowMin, windowMax, i), y: getRandomInt(windowMin, windowMax, i)} , 'group': [], 'average': 0} );
   }
   if (data.length <= 0) return centers;
   
   const distances = calculateDistances(data,centers);

   for (let i = 0; i < iterations; i++) {
      const assignments = assignToClusters(distances);
      updateCenters(data, assignments, centers);
   }


   return centers;
   
}


function updateCenters(dataPoints, assignments, centers) {
   const sums = Array(centers.length).fill(0).map( () => ({x:0, y:0}) );
   const counts = Array(centers.length).fill(0);

   for (let i = 0; i < dataPoints.length; i++) {
      const clusterID = assignments[i];
      counts[clusterID]++;
      sums[clusterID].x += dataPoints[i].x;
      sums[clusterID].y += dataPoints[i].y;
   }

   for (let i = 0; i < centers.length; i++) {
      if (counts[i] !== 0) {
         centers[i].center.x = sums[i].x / counts[i];
         centers[i].center.y = sums[i].y / counts[i];
         centers[i].group = dataPoints.filter( (_,x) => assignments[x]  == i);
      }
   }
}

function calculateDistances(dataPoints, centers) {
   const distances = [];
   for (let i = 0; i < dataPoints.length; i++) {
      distances[i] = new Array(centers.length).fill(0);
      for (let j = 0; j < centers.length; j++) {
         distances[i][j] = getDist2(dataPoints[i], centers[j].center);
      }
   }
   return distances;
}


function assignToClusters(distances) {
   const assignments = new Array(distances.length).fill(0);
   for (let i=0; i< distances.length; i++) {
      let closestCluster =0;
      let minDist = Infinity;
      for (let j=0; j < distances[i].length; j++) {
         if (distances[i][j] < minDist) {
            minDist = distances[i][j];
            closestCluster=j;
         }
      }
      assignments[i] = closestCluster;
   }
   return assignments;
}



function hex2rgb(hexText) {
   const r = (parseInt(hexText.slice(1), 16) >> 16) & 0xFF;
   const g = (parseInt(hexText.slice(1), 16) >> 8) & 0xFF;
   const b = (parseInt(hexText.slice(1), 16)) & 0xFF;
   return {r:r,g:g,b:b};
}

function pixelNearColor(curColor, curPixel, threshold) {
   const minR = Math.max(0, curColor.r -  threshold);
   const maxR = Math.min(255, curColor.r +  threshold);
   const minG = Math.max(0, curColor.g -  threshold);
   const maxG = Math.min(255, curColor.g +  threshold);
   const minB = Math.max(0, curColor.b -  threshold);
   const maxB = Math.min(255, curColor.b +  threshold);
   if (curPixel.r <= maxR && curPixel.r >= minR && curPixel.g >= minG && curPixel.g <= maxG && curPixel.b >= minB && curPixel.b <= maxB) {
      return true;
   }
   return false;


}

function pixelNearColorHSV(curColor, curPixel, threshold) {
   const cur = RGB2HSV(curColor);
   const pix = RGB2HSV(curPixel);
   const VALUE_THRESH = 90;
   const SAT_THRESH   = 70;
   const hue_thresh_min = Math.max(0, (cur.h - threshold) % 360);
   const hue_thresh_max = Math.min(359,(cur.h + threshold)) ;
   const sat_thresh_max = Math.min(100, (cur.s + SAT_THRESH));
   const sat_thresh_min = Math.max(0, (cur.s - SAT_THRESH));
   const val_thresh_max = Math.min(100, (cur.v + VALUE_THRESH));
   const val_thresh_min = Math.max(0, (cur.v - VALUE_THRESH));
   if (
         pix.h >= hue_thresh_min && pix.h <= hue_thresh_max &&
         pix.s >= sat_thresh_min && pix.s <= sat_thresh_max &&
         pix.v >= val_thresh_min && pix.v <= val_thresh_max
   ) return true;
   return false;
}


function drawCenter(canvasContext, point, radius) {
   canvasContext.beginPath();
   canvasContext.arc(point.x, point.y, radius, 0, Math.PI * 2);
   canvasContext.lineWidth = 10;
   canvasContext.stroke();
}


function getSurroundingPixels(point, maxWidth, maxHeight, layers) {
   const pixelPoints = new Array();
   for (let dx = -layers; dx <= layers; dx++) {
      const x = point.x + dx;
      if (x > maxWidth || x < 0) continue;

      for (let dy = -layers; dy <= layers; dy++ ) {
         const y = point.y + dy;
         if (y > maxHeight || y < 0) continue;
         pixelPoints.push({x:x, y:y});
      }
   }
   return pixelPoints;
}


function getAverageColor2(pixelPoints, imageData) {
   const color = {r:0, b:0, g:0};
   for (const point of pixelPoints) {
      const index = getIndex(point); 
      color.r += Math.pow(imageData[index], 2);
      color.g += Math.pow(imageData[index + 1],2);
      color.b += Math.pow(imageData[index + 2],2);
   }
   color.r = Math.sqrt(color.r/ pixelPoints.length) | 0;
   color.g = Math.sqrt(color.g/ pixelPoints.length) | 0;
   color.b = Math.sqrt(color.b/ pixelPoints.length) | 0;
   return color;
}


function getAverageColor(pixelPoints, imageData) {
   const color = {r:0, b:0, g:0};
   for (const point of pixelPoints) {
      const index = getIndex(point); 
      color.r += imageData[index], 2;
      color.g += imageData[index + 1];
      color.b += imageData[index + 2];
   }
   color.r = color.r/ pixelPoints.length | 0;
   color.g = color.g/ pixelPoints.length | 0;
   color.b = color.b/ pixelPoints.length | 0;
   return color;
}

function RGB2HSV(rgb) {
   const r = rgb.r/255;
   const g = rgb.g/255;
   const b = rgb.b/255;
   const cmax = Math.max(r,g,b);
   const cmin = Math.min(r,g,b);
   const colorDiff = cmax-cmin;
   var h, s, v;
   if       (cmax == cmin) {
      h = 0;
   } else if (cmax == r) {
      h = (60 * ( (g-b) / colorDiff) + 360)  % 360;
   } else if (cmax == g) {
      h = (60 * ( (b-r) / colorDiff) + 120)  % 360;
   } else if (cmax == b) {
      h = (60 * ( (r-g) / colorDiff) + 240)  % 360;
   }
   if (cmax == 0) {
      s = 0;
   } else {
      s = (colorDiff / cmax) * 100;
   }

   v = cmax * 100;

   return {h:h, s:s, v:v};
}
