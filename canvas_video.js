export class CanVid {
   constructor(canvasElementName, videoElementName) {
      this.cid = document.getElementById(canvasElementName);
      console.log(this.cid);
      this.context = this.cid.getContext("2d", { WillReadFrequently: true });
      this.vid = document.createElement(videoElementName);

      //this.cid.addEventListener("mousedown", (evt) => {
      //   pixelIndex = getSurroundingPixels({ x: evt.x, y: evt.y }, this.cid.width, this.cid.height, 4);
      //})

   }
   toVideoDimensions() {
      this.cid.width = this.vid.videoWidth;
      this.cid.height = this.vid.videoHeight;
   }

   render(detector, pixelIndex, newColor) {
      navigator.mediaDevices.getUserMedia({ video: true })
         .then((videoBytes) => {
            this.vid.srcObject = videoBytes;
            this.vid.play();
            this.vid.onloadeddata = () => {
               this.toVideoDimensions();
               this.execute(detector, pixelIndex, newColor);
            }
         }).catch((error) => alert(error));
   }

   execute(detector, pixelIndex, newColor) {
      this.context.drawImage(this.vid, 0, 0, this.cid.width, this.cid.height);
      const imageData = this.context.getImageData(0, 0, this.cid.width, this.cid.height);
      const centers = detector.detect(imageData, pixelIndex, this.cid);
      if (centers && centers.length > 0) {
         this.context.fillStyle = newColor;
         for (const c of centers) {
            for (const point of c.group) {
               this.context.fillRect(point.x, point.y, 1, 1);
            }

         }
      }
      pixelIndex = null;
      requestAnimationFrame(() => this.execute(detector, pixelIndex));
   }


}

function getSurroundingPixels(point, maxWidth, maxHeight, layers) {
   const pixelPoints = new Array();
   for (let dx = -layers; dx <= layers; dx++) {
      const x = point.x + dx;
      if (x > maxWidth || x < 0) continue;

      for (let dy = -layers; dy <= layers; dy++) {
         const y = point.y + dy;
         if (y > maxHeight || y < 0) continue;
         pixelPoints.push({ x: x, y: y });
      }
   }
   return pixelPoints;
}
