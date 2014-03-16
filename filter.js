
var domready = require('domready');
var stackblur = require('stackblur');

domready(function() {
    var canvas = document.createElement("canvas"),
        mask = document.createElement("canvas");
    document.body.appendChild(canvas);

    var context = canvas.getContext("2d"),
        maskContext = mask.getContext("2d");

    //If we weren't using base 64, we could use a big image that fills the screen
    var width = 500, 
        height = 313;

    
 
    mask.width = canvas.width = width;
    mask.height = canvas.height = height;

    document.body.style.background = "black";
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    var blurred;

    var img = getImage();

    var time = 0;

    var imgWidth, imgHeight;

    var tweener = {
        clip: 0,
        y: 0
    };

    var motion = {
        x: 0, y: 0
    };

    window.addEventListener("resize", function() {
        // mask.width = canvas.width = width = window.innerWidth;
        // mask.height = canvas.height = height = 400;
    }, false);

    window.addEventListener("mousemove", function(ev) {
        TweenLite.to(motion, 0.5, {
            ease: Strong.easeOut,
            x: imgWidth/2 - ev.clientX,
            y: imgHeight/2 - ev.clientY,
            overwrite: 1
        });
    }, false);

    

    function createBlur() {
        var radius = 20;
        blurred = document.createElement("canvas");
        blurred.width = imgWidth;
        blurred.height = imgHeight;
        var blurredContext = blurred.getContext("2d");

        blurredContext.drawImage(img, 0, 0);
        var imgData = blurredContext.getImageData(0, 0, imgWidth, imgHeight);
        var pixels = imgData.data;

        stackblur.blur(pixels, imgWidth, imgHeight, radius);
        stackblur.blur(pixels, imgWidth, imgHeight, radius);

        blurredContext.putImageData(imgData, 0, 0);
    }

    function animate(delay) {
        delay=delay||0;

        TweenLite.fromTo(tweener, 1.0, {
            clip: 1,
        }, {
            clip: 0,
            delay: delay+0.5,
            ease: Strong.easeOut 
        });

        TweenLite.fromTo(tweener, 2.0, {
            y: height,
        }, {
            y: 0,
            delay: delay+1.25,
            ease: Strong.easeOut
        });

        TweenLite.to(tweener, 0.75, {
            y: height,
            clip: 1,
            delay: delay+5,
            ease: Strong.easeOut,
            onComplete: animate.bind(this, 2.0)
        });
    }

    //usually we would just pipe start() function into the image's load listener...
    //codepen workarounds make this kinda tricky though
    var started = false;
    requestAnimationFrame(render);

    function start() {
        started = true;
        imgWidth = img.width;
        imgHeight = img.height;
        
        createBlur();
        animate();

        render();
    }



    function render() {
        //not loaded
        if (!started && img.width !== 0) {
            start();
        }
        time += 0.01;


        var aspect = imgWidth/imgHeight;
        var dstHeight = width / aspect;

        requestAnimationFrame(render);

        context.clearRect(0, 0, width, height);

        
        context.drawImage(blurred, 0, 0, width, dstHeight);


        maskContext.clearRect(0, 0, width, height);
        maskContext.fillStyle = 'white';
        maskContext.globalCompositeOperation = 'source-over';

        var fontSize = 200;
        maskContext.font = "bold "+fontSize+"px 'Arial Black', 'Helvetica', sans-serif";
        maskContext.textBaseline = "middle";
        maskContext.textAlign = "center";

        var parallax = -0.05;
        var hoff = Math.min(height/2, dstHeight/2);
        maskContext.fillText("NYC", width/2 + motion.x*parallax, tweener.y + hoff + motion.y*parallax);

        maskContext.fillRect(0, 0, width, tweener.clip * dstHeight);

        maskContext.globalCompositeOperation = 'source-in';
        maskContext.drawImage(img, 0, 0, width, dstHeight);

        context.drawImage(mask, 0, 0, width, height);
    }

});

function getImage(onload) {
    return document.getElementById("image");
}