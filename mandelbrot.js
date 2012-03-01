/*
 * Vanilla Mandelbrot Set renderer with canvas and javascript
 *
 * Written by Christian Stigen Larsen
 * http://csl.sublevel3.org
 * https://github.com/cslarsen/mandelbrot-js
 *
 * Put in the public domain by the author
 * 2012-03-01
 *
 */

var lookAt = [-0.6, 0];
var zoom = 3.0;
var xRange = [lookAt[0]-zoom, lookAt[0]+zoom];
var yRange = [lookAt[1]-zoom, lookAt[1]+zoom];
var useHSV = false;

// Just a shorthand function
function $(id)
{
  return document.getElementById(id);
}

$('zoom').innerHTML = 1.0/zoom;

$('canvasMandelbrot').onclick = function(event)
{
  var x = event.clientX;
  var y = event.clientY;
  var w = window.innerWidth;
  var h = window.innerHeight;

  x /= (0.5 + (canvas.width-1));
  x = xRange[0] + x*(xRange[1] - xRange[0]);

  y /= (0.5 + (canvas.height-1));
  y = yRange[0] + y*(yRange[1] - yRange[0]);

  lookAt = [x, y];
  zoom *= 0.5;
  draw(lookAt, zoom);
}

function scaled(number)
{
  var unit = ["", "k", "M", "G", "T", "P", "E"];
  var mag = Math.ceil((1+Math.log(number)/Math.log(10))/3);
  return "" + number/Math.pow(10, 3*(mag-1)) + unit[mag];
}

/*
 * H = [0, 360]
 * S = [0, 1]
 * V = [0, 1]
 */
function hsv_to_rgb(h, s, v)
{
  var hp = h/60.0;
  var c = v * s;
  var x = c*(1 - Math.abs((hp % 2) - 1));

  if ( 0<=hp && hp<1 ) rgb = [c, x, 0];
  if ( 1<=hp && hp<2 ) rgb = [x, c, 0];
  if ( 2<=hp && hp<3 ) rgb = [0, c, x];
  if ( 3<=hp && hp<4 ) rgb = [0, x, c];
  if ( 4<=hp && hp<5 ) rgb = [x, 0, c];
  if ( 5<=hp && hp<6 ) rgb = [c, 0, x];

  var m = v - c;
  rgb[0] += m;
  rgb[1] += m;
  rgb[2] += m;

  rgb[0] *= 255;
  rgb[1] *= 255;
  rgb[2] *= 255;
  return rgb;
}

/*
 * Color table can be any length, but should be
 * cyclical because of the modulus operation.
 */
var colors = new Array(512);
var interiorColor = [0, 0, 0, 255];

/*
 * Simple calculation of the color palette.
 * This version is non-cyclical.
 */
for ( var i=0; i<colors.length; ++i ) {
  var R = i<256? i : 255;
  var G = i<256? i : 255;
  var B = i<256? i : 255;
  var A = 255;
  colors[i] = [R, G, B, A];
}

// Whether to reload canvas size, etc.
var reinit = true;

window.onresize = function(event)
{
  // reinit dimentions on window resize
  reinit = true;
}

function adjustAspectRatio(xRange, yRange, canvas)
{
  /*
   * Adjust aspect ratio
   */
  var ratio = Math.abs(xRange[1]-xRange[0]) / Math.abs(yRange[1]-yRange[0]);
  var sratio = canvas.width/canvas.height;

  if ( sratio > ratio ) {
    var f = sratio/ratio;
    xRange[1] *= f;
    xRange[0] *= f;
  } else if ( sratio < ratio ) {
    var f = ratio/sratio;
    yRange[1] *= f;
    yRange[0] *= f;
  }
}

function draw(lookAt, zoom)
{
  if ( reinit ) {
    canvas = $('canvasMandelbrot');
    ctx = canvas.getContext('2d');

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    //canvas.width = 640; canvas.height = 480;

    img = ctx.createImageData(canvas.width, 1);
    reinit = false;
  }

  $('zoom').innerHTML = 1.0/zoom;

  var steps = parseInt($('steps').value);
  var escapeRadius = Math.pow(parseFloat($('escapeRadius').value), 2.0);

  /*
   * Plot rectangle in the complex plane
   */
  if ( lookAt == null ) lookAt = [-0.6, 0];
  if ( zoom == null ) zoom = 2.0;
  xRange = [lookAt[0]-zoom/2, lookAt[0]+zoom/2];
  yRange = [lookAt[1]-zoom/2, lookAt[1]+zoom/2];

  adjustAspectRatio(xRange, yRange, canvas);

  var dx = (xRange[1] - xRange[0]) / (0.5 + (canvas.width-1));
  var dy = (yRange[1] - yRange[0]) / (0.5 + (canvas.height-1));

  function drawLine(Ci, off, Cr_init, Cr_step, pixels)
  {
    var Cr = Cr_init;
    var logBase = 1.0 / Math.log(2.0);
    var logHalfBase = Math.log(0.5)*logBase;

    for ( var x=0; x<canvas.width; ++x, Cr += Cr_step ) {
      var Zr = 0;
      var Zi = 0;
      var Tr = 0;
      var Ti = 0;
      var n  = 0;

      for ( ; n<steps && (Tr+Ti)<=escapeRadius; ++n ) {
        Zi = 2 * Zr * Zi + Ci;
        Zr = Tr - Ti + Cr;
        Tr = Zr * Zr;
        Ti = Zi * Zi;
      }

      /*
       * Four more iterations to decrease error term;
       * see http://linas.org/art-gallery/escape/escape.html
       */
      for ( var e=0; e<4; ++e ) {
        Zi = 2 * Zr * Zi + Ci;
        Zr = Tr - Ti + Cr;
        Tr = Zr * Zr;
        Ti = Zi * Zi;
      }

      /*
       * Did equation converge?  Then this is an interior, and we'll
       * simply paint it black.
       */
      var color = interiorColor;

      // Did it diverge? Then we've got an exterior
      if ( n != steps ) {
        // Instead of using RGB[i] directly, calculate smooth coloring:

        /*
         * Original smoothing equation is
         *
         * var v = 1 + n - Math.log(Math.log(Math.sqrt(Zr*Zr+Zi*Zi)))/Math.log(2.0);
         *
         * but can be simplified using some elementary logarithm rules to
         */
        var v = 5 + n - logHalfBase - Math.log(Math.log(Tr+Ti))*logBase;

        // then normalize for number of colors
        if ( isNaN(v) ) v = 0;
        if ( !isFinite(v) ) v = steps;

        if ( useHSV ) {
          v = Math.floor(v) % 360;
          color = hsv_to_rgb(v, 1.0, 1.0);
        } else {
          v = Math.abs(colors.length*v/steps);
          color = colors[Math.floor(v) % colors.length];
        }

        // add alpha
        color.push(255);
      }

      img.data[off++] = color[0];
      img.data[off++] = color[1];
      img.data[off++] = color[2];
      img.data[off++] = color[3];
    }
  }

  function render() {
    var start  = (new Date).getTime();
    var pixels = 0;
    var y = yRange[0];

    for ( var sy = 0; sy < canvas.height; ++sy ) {
      drawLine(y, 0, xRange[0], dx);
      y += dy;
      pixels += canvas.width;
      ctx.putImageData(img, 0, sy);
    }

    var elapsedMS = (new Date).getTime() - start;
    $('renderTime').innerHTML = elapsedMS/1000.0;
    $('renderSpeed').innerHTML = scaled(Math.floor(pixels/elapsedMS));
    $('submitButton').disabled = false;
  };

  // Disallow redrawing while rendering
  $('submitButton').disabled = true;

  // Start rendering in background
  setTimeout(render);
}
