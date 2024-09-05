import { CanVid } from "./canvas_video.js"
const WASM_MODULE = "color_detector.wasm";



class Wasm {
   constructor() {
      //this.gl = gl;
      this.canvid = new CanVid("replication", "video");
      this.color_detect = "#FF0000";
      this.color_replace = "#0000FF";
      this.threshold = 40;
   }

   async initialize() {
      const EXPORTS = {
         env: {
            logW: (s, s_len) => this.wasm_log(s, s_len),
            getReplacementColor: this.getReplacementColor.bind(this),
            getDetectColor: this.getDetectColor.bind(this),
            processCenters: this.processCenters.bind(this),
            getThresholdValue: this.getThresholdValue.bind(this),
            getWidth: this.getWidth.bind(this),
            getHeight: this.getHeight.bind(this),

         },
      };

      const exported = await WebAssembly.instantiateStreaming(fetch(WASM_MODULE), EXPORTS);
      this.memory = exported.instance.exports.memory;
      this.wasm = exported.instance.exports;

   }

   wasm_log(string, length) {
      const buf = new Uint8Array(this.memory.buffer, string, length);
      if (length == 0) return;
      console.log(new TextDecoder("utf-8").decode(buf));
   }

   canvas_render() {
      navigator.mediaDevices.getUserMedia({ video: true })
         .then((videoBytes) => {
            this.canvid.vid.srcObject = videoBytes;
            this.canvid.vid.play();
            this.canvid.vid.onloadedmetadata = () => {
               this.canvid.toVideoDimensions();
               this.wasm.updateWindowParams();
               this.execute();
            }
         }).catch((error) => alert(error));
   }

   execute() {
      this.canvid.context.drawImage(this.canvid.vid, 0, 0, this.canvid.cid.width, this.canvid.cid.height);
      const imageData = this.canvid.context.getImageData(0, 0, this.canvid.cid.width, this.canvid.cid.height);
      //const imgData = new Uint8ClampedArray(memory.buffer, imageData.data, imageData.data.length);
      this.appendImageData(imageData.data);
      this.wasm.updateDetectColor();
      this.wasm.updateThreshold();
      this.wasm.detect();

      requestAnimationFrame(() => this.execute());
   }

   appendImageData(image_data) {
      const BUFFER_SIZE = 16384;
      var remaining_length = image_data.length;
      var i = 0;
      while (remaining_length != 0) {
         const chunk_size = Math.min(BUFFER_SIZE, remaining_length);
         const buf = new Uint8Array(this.memory.buffer, this.wasm.global_chunk.value, chunk_size);
         buf.set(image_data.slice(i, i + chunk_size));
         this.wasm.pushData(i, chunk_size);
         i += chunk_size;
         remaining_length -= chunk_size;
      }
   }

   getReplacementColor() {
      //const value = parseInt(this.color_replace.slice(1), 16)
      return parseInt(this.color_replace.slice(1), 16);
   }

   getDetectColor() {
      return parseInt(this.color_detect.slice(1), 16);
   }

   getThresholdValue() {
      return this.threshold;
   }

   getWidth() {
      return this.canvid.cid.clientWidth;
   }

   getHeight() {
      return this.canvid.cid.clientHeight;
   }

   processCenters(items, items_len) {
      const replacers = new Int32Array(this.memory.buffer, items, items_len);
      this.canvid.context.fillStyle = this.color_replace;
      for (let i = 0; i < items_len; i++) {
         if (i == Math.pow(2, 32)) continue;
         const index = replacers[i] / 4;
         const x = index % this.canvid.cid.clientWidth;
         const y = Math.floor(index / this.canvid.cid.clientWidth);
         this.canvid.context.fillRect(x, y, 1, 1);

      }


   }
   initColorReplacer() {
      const replacer = document.createElement("input");
      const color_container = document.getElementById('color-replacer');
      const replacer_header = document.createElement('h3');
      replacer_header.textContent = "Choose replacement color:";
      replacer.id = 'color-replacer';
      replacer.type = 'color';
      replacer.value = this.color_replace;
      color_container.appendChild(replacer_header);
      color_container.appendChild(replacer);
      replacer.addEventListener("change", (event) => {
         console.log(event.target.value);
         this.color_replace = event.target.value;
      })
   }


   initColorSelector() {
      const color_selector = document.getElementById('color-selector');
      const color_selector_menu = document.createElement('input');
      color_selector_menu.type = "color";
      color_selector_menu.id = "selected-color";
      color_selector_menu.value = this.color_detect;
      color_selector.appendChild(color_selector_menu);
      color_selector_menu.addEventListener("change", (event) => {
         console.log(event.target.value);
         //this.color_to_detect = hex2rgb(event.target.value);
         this.color_detect = event.target.value;
         //console.log("New color selected: ", COLOR, RGB2HSV(COLOR));
      });
   }

   initThresholdSelector() {
      const threshold = document.createElement("input");
      threshold.type = "range";
      threshold.min = 0;
      threshold.max = 100;
      threshold.value = this.threshold;
      const thresh_select = document.getElementById("thresh-select");
      const header = document.createElement("h2");
      header.textContent = `Threshold Value = ${threshold.value}`
      threshold.addEventListener("input", (_) => {
         header.textContent = `Threshold Value = ${threshold.value}`
         this.threshold = threshold.value;
      })
      thresh_select.appendChild(header);
      thresh_select.appendChild(threshold);
   }

   initCanvasColorSelector() {
      this.canvid.cid.addEventListener("click", (evt) => {
         const x = evt.clientX;
         const y = evt.clientY;
         //console.log(x, y);
         const rgb = this.wasm.getAverageColor(x, y, 4);
         //console.log((rgb >>> 0).toString(16));
         this.color_detect = "#" + (rgb >>> 8).toString(16);
         //console.log(this.color_detect);
         //console.log("Width", this.canvid.cid.clientWidth);
         //console.log("Height", this.canvid.cid.clientHeight);
      })
   }

}



async function init() {
   const wasm = new Wasm();
   await wasm.initialize();
   wasm.initColorReplacer();
   wasm.initColorSelector();
   wasm.initThresholdSelector();
   wasm.initCanvasColorSelector();

   wasm.canvas_render();
}






function hex2rgb(hexText) {
   const r = (parseInt(hexText.slice(1), 16) >> 16) & 0xFF;
   const g = (parseInt(hexText.slice(1), 16) >> 8) & 0xFF;
   const b = (parseInt(hexText.slice(1), 16)) & 0xFF;
   return { r: r, g: g, b: b };
}





window.onload = init;
