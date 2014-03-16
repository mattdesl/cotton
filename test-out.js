(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Class = require('klasse');
var PointMass = require('verlet3d').PointMass;

var Cloth = new Class({
	

	initialize: function(width, height, options) {
		options = options || {};

		this.width = width;
		this.height = height;

		this.startX = options.startX || 0;
		this.startY = options.startY || 0;

		this.spacing = options.spacing || 5;

		this.stiffness = typeof options.stiffness === "number" ? options.stiffness : 0.1;
		this.tearDistance = typeof options.tearDistance === "number" ? options.tearDistance : 100;
		this.mass = typeof options.mass === "number" ? options.mass : 1;

		this.points = [];
		this.create();
	},

	create: function() {
		var points = this.points;

        var spacing = this.spacing;
        var start_x = this.startX;
        var start_y = this.startY;
        var mass = this.mass;
        var stiff = this.stiffness;
        var tear = this.tearDistance;
        var usePins = false;

        var rows = Math.floor( this.height/spacing );
        var cols = Math.floor( this.width/spacing );
        
        this.rows = rows;
        this.cols = cols;

        //clear current point list
        points.length = 0;
        for (var y = 0; y <= rows; y++) {
            for (var x = 0; x <= cols; x++) {
                var p = new PointMass(start_x + x * spacing, start_y + y * spacing, 0, mass);

                var edge = !usePins 
                        ? (y === 0)
                        : (y === 0 || x === 0 || y === rows || x === cols);

                if (x!==0)
                    p.attach(points[points.length - 1], spacing, stiff, tear);
                if (edge)
                    p.pin(p.position.x, p.position.y, 0);
                if (y !== 0)
                    p.attach(points[ x + (y - 1) * (cols + 1)], spacing, stiff, tear);

                points.push(p);
            }
        }
    },
});

module.exports = Cloth;
},{"klasse":23,"verlet3d":36}],2:[function(require,module,exports){
var Class = require('klasse');


var MeshRenderer = require('kami-mesh').MeshRenderer;
var domready = require('domready');


var ShaderProgram = require('kami').ShaderProgram;

var Matrix4 = require('vecmath').Matrix4;
var OrthographicCamera = require('cam3d').OrthographicCamera;
var PerspectiveCamera = require('cam3d').PerspectiveCamera;

var Vector3 = require('vecmath').Vector3;
var Matrix3 = require('vecmath').Matrix3;

var rot = new Matrix3();
var tmpVec = new Vector3();
var tmpVec2 = new Vector3();
var tmpVec3 = new Vector3();

var ClothRenderer = new Class({

	initialize: function(context, vert, frag) {
        this.context = context;

        this.camera = new OrthographicCamera();
        this.camera.setToOrtho(true, context.width, context.height);

        // this.camera = new PerspectiveCamera(85 * Math.PI/180, context.width, context.height);
        // this.camera.far = 1000;

        this.shader = new ShaderProgram(context, vert, frag);
        if (this.shader.log)
            console.warn(this.shader.log);

        this.time = 0;

        this.mesh = new MeshRenderer(context, {
            hasColors: true,
            maxVertices: 150000,
            hasNormals: true,
            numTexCoords: 1
        });

        this.lightPosition = new Vector3();
	},



    resize: function(width, height) {
        // this.camera
    }, 

    draw: function(world, width, height) {
        var gl = this.context.gl;
        var r = this.mesh;
        var shader = this.shader;
        var cam = this.camera;

        this.time += 0.1;

        // //orbit our camera a little around center 
        // var hr = this.time*0.1;
        // var cameraRadius = 555;

        // var x = (Math.cos(hr)) * cameraRadius,
        //     z = (Math.sin(hr)) * cameraRadius;

        // cam.position.x = x;
        // cam.position.y = 500;
        // cam.position.z = z;

        // //keep the cam looking at centre of world
        // cam.lookAt(0, 0, 0);
        // cam.up.set(0, 1, 0); 

        // // cam.view.scale( tmpVec.set(0.25, 0.25, 0.25) );

        // //call update() to create the combined matrix
        // cam.update(); 

        r.shader = shader;
        r.begin(cam.combined, gl.TRIANGLES);

        shader.setUniformi("u_sampler0", 0);
        shader.setUniformi("u_sampler1", 1);
        shader.setUniformf("time", this.time);
        shader.setUniformf("LightPos", this.lightPosition.x, this.lightPosition.y, this.lightPosition.z);
        shader.setUniformf("LightColor", 1, .8, .8, .6);
        shader.setUniformf("AmbientColor", .6, .6, 1, 1);
        shader.setUniformf("Falloff", 0.001, 1, 1);
        shader.setUniformf("Resolution", this.context.width, this.context.height);

        for (var i=0; i<world.points.length; i++) {
            var p = world.points[i];

            if (p.constraints.length >= 2) {
                var c = p.constraints;

                var botLeft = c[0].p2;
                var topRight = c[1].p2;

                var index = i;

                var tri = topRight.constraints.length > 0;
                this.drawTriangle(botLeft.position, topRight.position, p.position, index, width, height);

                if (tri) {
                    c = topRight.constraints;
                    var other = c[0].p2;
                    this.drawTriangle(botLeft.position, other.position, topRight.position, index, width, height, true);
                }
            }
        }

        r.end();

        r.begin(cam.combined, gl.LINES);
        for (var i=0; i<world.points.length; i++) {
            var p = world.points[i];
            this.drawLines(p);
        }
        r.end();
    },

    computeNormal: function(a, b, c) {
        // tmpVec.set(0, 0, 1);

        // //Get centroid of triangle
        // //Get dir from Unit Z vector to centroid
        // //Normalize
        // // tmpVec2.x = a.x + b.x + c.x;
        // // tmpVec2.y = a.y + b.y + c.y;
        // // tmpVec2.x /= 3;
        // // tmpVec2.y /= 3;
        // // tmpVec2.z /= 3;
        // tmpVec2.normalize();
        // return tmpVec.set(0, 0, 1).add(tmpVec2);

        // this is a little ugly since a, b, c are actually Vector2, not Vector3 !!
        tmpVec3.set(a.x, a.y, a.z);
        tmpVec.copy(b).sub( tmpVec3 );

        tmpVec3.set(a.x, a.y, a.z);
        tmpVec2.copy(c).sub( tmpVec3 );
        return tmpVec.cross(tmpVec2).normalize();
    },

    drawLines: function(p) {
        var r = this.mesh;
        var a = 0.2;
        var color = 0.5;

        var n = tmpVec.set(0, 0, 1);
        for (var j=0; j<p.constraints.length; j++) {
            var c = p.constraints[j];

            r.color(color,color,color,a);
            r.texCoord(0, 0);
            r.normal(n.x,n.y,n.z);
            r.vertex(c.p1.position.x, c.p1.position.y, c.p1.position.z);

            r.color(color,color,color,a);
            r.texCoord(0, 0);
            r.normal(n.x,n.y,n.z);
            r.vertex(c.p2.position.x, c.p2.position.y, c.p2.position.z);
        }
    },

    drawTriangle: function(p1, p2, p3, i, width, height, flip) {
        var n = this.computeNormal(p1, p2, p3);
        var a = .7;

        width ++;
        height ++;

        var y = ~~(i / width);
        var x = ~~(i - width*y);

        var u = x/width;
        var v = y/height;
        var uOff = 1/width;
        var vOff = 1/height;



        var r = this.mesh;
        r.color(a,a,a,1);
        r.texCoord(u, v);
        r.normal(n.x,n.y,n.z);
        r.vertex(p1.x, p1.y, p1.z);

        r.color(a,a,a,1);
        if (flip)
            r.texCoord(u, v-vOff);
        else
            r.texCoord(u+uOff, v-vOff);
        r.normal(n.x,n.y,n.z);
        r.vertex(p2.x, p2.y, p2.z);

        r.color(a,a,a,1);
        if (flip)
            r.texCoord(u+uOff, v-vOff);
        else
            r.texCoord(u+uOff, v);
        r.normal(n.x,n.y,n.z);
        r.vertex(p3.x, p3.y, p3.z);
            
    },
});

module.exports = ClothRenderer;
},{"cam3d":6,"domready":8,"kami":20,"kami-mesh":9,"klasse":23,"vecmath":32}],3:[function(require,module,exports){
var Class = require('klasse');

var util = require('./vecutil');

var Vector2 = require('vecmath').Vector2;
var Vector3 = require('vecmath').Vector3;
var Vector4 = require('vecmath').Vector4;
var Matrix4 = require('vecmath').Matrix4;

var tmpVec3 = new Vector3();
var tmpVec4 = new Vector4();

/** 
 * Abstract base class for cameras to implement.
 * @class Camera
 * @abstract
 */
var Camera = new Class({
	
    initialize: function() {
        this.direction = new Vector3(0, 0, -1);
        this.up = new Vector3(0, 1, 0);
        this.position = new Vector3();
        
        this.projection = new Matrix4();
        this.view = new Matrix4();
        this.combined = new Matrix4();
        this.invProjectionView = new Matrix4();

        this.near = 1;
        this.far = 100;

        this.ray = {
            origin: new Vector3(),
            direction: new Vector3()
        };

        this.viewportWidth = 0;
        this.viewportHeight = 0;
    },

    /**
     * Translates this camera by a specified Vector3 object
     * or x, y, z parameters. Any undefined x y z values will
     * default to zero, leaving that component unaffected.
     * 
     * @param  {[type]} vec [description]
     * @return {[type]}     [description]
     */
    translate: function(x, y, z) {
        if (typeof x === "object") {
            this.position.x += x.x || 0;
            this.position.y += x.y || 0;
            this.position.z += x.z || 0;
        } else {
            this.position.x += x || 0;
            this.position.y += y || 0;
            this.position.z += z || 0;
        }
    },

    lookAt: function(x, y, z) {
        var dir = this.direction,
            up = this.up;

        if (typeof x === "object") {
            dir.copy(x);
        } else {
            dir.set(x, y, z);
        }

        dir.sub(this.position).normalize();

        //calculate right vector
        tmpVec3.copy(dir).cross(up).normalize();

        //calculate up vector
        up.copy(tmpVec3).cross(dir).normalize();
    },

    rotate: function(radians, axis) {
        util.rotate( this.direction, axis, radians );
        util.rotate( this.up, axis, radians );
    },

    rotateAround: function(point, radians, axis) {
        tmpVec.copy(point).sub(this.position);
        this.translate( tmpVec );
        this.rotate( radians, axis );
        this.translate( tmpVec.negate() );
    },

    project: function(vec, out) {
        if (!out)
            out = new Vector4();

        //TODO: support viewport XY
        var viewportWidth = this.viewportWidth,
            viewportHeight = this.viewportHeight,
            n = Camera.NEAR_RANGE,
            f = Camera.FAR_RANGE;

        // for useful Z and W values we should do the usual steps...
        //    clip space -> NDC -> window coords

        //implicit 1.0 for w component
        tmpVec4.set(vec.x, vec.y, vec.z, 1.0);
        
        //transform into clip space
        tmpVec4.transformMat4( this.combined );
        
        //now into NDC
        tmpVec4.x = tmpVec4.x / tmpVec4.w;
        tmpVec4.y = tmpVec4.y / tmpVec4.w;
        tmpVec4.z = tmpVec4.z / tmpVec4.w;
        
        //and finally into window coordinates
        out.x = viewportWidth/2 * tmpVec4.x + (0 + viewportWidth/2);
        out.y = viewportHeight/2 * tmpVec4.y + (0 + viewportHeight/2);
        out.z = (f-n)/2 * tmpVec4.z + (f+n)/2;

        //if the out vector has a fourth component, we also store (1/clip.w)
        //same idea as gl_FragCoord.w
        if (out.w === 0 || out.w)
            out.w = 1/tmpVec4.w;
        
        return out;
    },

    unproject: function(vec, out) {
        if (!out)
            out = new Vector3();

        var viewport = tmpVec4.set(0, 0, this.viewportWidth, this.viewportHeight);
        return out.copy(vec).unproject( viewport, this.invProjectionView );
    },

    getPickRay: function(x, y) {
        var origin = this.ray.origin.set(x, y, 0),
            direction = this.ray.direction.set(x, y, 1),
            viewport = tmpVec4.set(0, 0, this.viewportWidth, this.viewportHeight),
            mtx = this.invProjectionView;

        origin.unproject(viewport, mtx);
        direction.unproject(viewport, mtx);

        direction.sub(origin).normalize();
        return this.ray;
    },

    update: function() {
        //left empty for subclasses
    }
});

Camera.FAR_RANGE = 1.0;
Camera.NEAR_RANGE = 0.0;

// Regarding method overloading. It introduces a slow-down,
// but presumably this is negligible compared to the benefit of convenience.
// Besides, this is a high-level API!
// http://jsperf.com/arguments-length-perf

module.exports = Camera;



},{"./vecutil":7,"klasse":23,"vecmath":32}],4:[function(require,module,exports){
var Class = require('klasse');

var Vector3 = require('vecmath').Vector3;
var Vector4 = require('vecmath').Vector4;
var Matrix4 = require('vecmath').Matrix4;

var Camera = require('./Camera');

var tmpVec3 = new Vector3();

var OrthographicCamera = new Class({

	Extends: Camera,

	initialize: function(viewportWidth, viewportHeight) {
		Camera.call(this);
		this.viewportWidth = viewportWidth;
		this.viewportHeight = viewportHeight;

		this.zoom = 1.0;
		this.near = 0;
		this.update();
	},

	setToOrtho: function(yDown, viewportWidth, viewportHeight) {
		var zoom = this.zoom;
		viewportWidth = typeof viewportWidth === "number" ? viewportWidth : this.viewportWidth;
		viewportHeight = typeof viewportHeight === "number" ? viewportHeight : this.viewportHeight;

		this.up.set(0, yDown ? -1 : 1, 0);
		this.direction.set(0, 0, yDown ? 1 : -1);
		this.position.set(zoom * viewportWidth/2, zoom * viewportHeight/2, 0);

		this.viewportWidth = viewportWidth;
		this.viewportHeight = viewportHeight;
		this.update();
	},

	update: function() {
		//TODO: support x/y offset
		var w = this.viewportWidth,
			h = this.viewportHeight,
			near = Math.abs(this.near),
			far = Math.abs(this.far),
			zoom = this.zoom;

		this.projection.ortho(
					zoom * -w/2, zoom * w/2, 
					zoom * -h/2, zoom * h/2,
					near, far);		
		

		//build the view matrix 
		tmpVec3.copy(this.position).add(this.direction);
		this.view.lookAt(this.position, tmpVec3, this.up);


		//projection * view matrix
		this.combined.copy(this.projection).mul(this.view);

		//invert combined matrix, used for unproject
		this.invProjectionView.copy(this.combined).invert();
	}
});

module.exports = OrthographicCamera;
},{"./Camera":3,"klasse":23,"vecmath":32}],5:[function(require,module,exports){
var Class = require('klasse');

var Matrix4 = require('vecmath').Matrix4;
var Vector2 = require('vecmath').Vector2;
var Vector3 = require('vecmath').Vector3;
var Camera = require('./Camera');

var tmpVec3 = new Vector3();

var dirvec = null,
    rightvec = null,
    billboardMatrix = null;

var PerspectiveCamera = new Class({

	Extends: Camera,

	//fov in RADIANS!
	initialize: function(fieldOfView, viewportWidth, viewportHeight) {
		Camera.call(this);
		this.viewportWidth = viewportWidth;
		this.viewportHeight = viewportHeight;

        this.billboardMatrixDirty = true;

		this.fieldOfView = fieldOfView;
		this.update();
	},

	/**
	 * This method sets the width and height of the viewport.
	 * 
	 * @method  setViewport
	 * @param {Number} width  the viewport width
	 * @param {Number} height the viewport height
	 */
	setViewport: function(width, height) {
		this.viewportWidth = width;
		this.viewportHeight = height;
	},

    /**
     * This is a helper function to determine the scaling factor
     * for 2D billboard sprites when projected in 3D space. 
     *
     * @param  {vec3} position     the 3D position
     * @param  {vec2} originalSize the 2D sprite size
     * @return {vec2}              the output size
     */
    // projectedScale: function(position, originalSize, out) {
    // },



    updateBillboardMatrix: function() {
        if (!dirvec) {
            dirvec = new Vector3();
            rightvec = new Vector3();
            billboardMatrix = new Matrix4();
        }


        var dir = dirvec.set(this.direction).negate();

        // Better view-aligned billboards might use this:
        // var dir = tmp.set(camera.position).sub(p).normalize();
        
        var right = rightvec.set(this.up).cross(dir).normalize();
        var up = tmpVec3.set(dir).cross(right).normalize();

        var out = billboardMatrix.val;
        out[0] = right.x;
        out[1] = right.y;
        out[2] = right.z;
        out[3] = 0;
        out[4] = up.x;
        out[5] = up.y;
        out[6] = up.z;
        out[7] = 0;
        out[8] = dir.x;
        out[9] = dir.y;
        out[10] = dir.z;
        out[11] = 0;
        out[12] = 0;
        out[13] = 0;
        out[14] = 0;
        out[15] = 1;

        this.billboardMatrixDirty = false;
    },

    /**
     * This is a utility function for canvas 3D rendering, 
     * which determines the "point size" of a camera-facing
     * sprite billboard given its 3D world position 
     * (origin at center of sprite) and its world width
     * and height in x/y. 
     *
     * We place into the output Vector2 the scaled width
     * and height. If no `out` is specified, a new Vector2
     * will be created for convenience (this should be avoided 
     * in tight loops).
     * 
     * @param  {Vector3} vec the position of the 3D sprite
     * @param  {Vector2} size the x and y dimensions of the sprite
     * @param  {Vector2} out the result, scaled x and y dimensions in 3D space
     * @return {Vector2} returns the out parameter, or a new Vector2 if none was given    
     */
    getPointSize: function(vec, size, out) {
        //TODO: optimize this with a simple distance calculation:
        //https://developer.valvesoftware.com/wiki/Field_of_View

        if (!out)
            out = new Vector2();

        if (this.billboardMatrixDirty)
            this.updateBillboardMatrix();

        var tmp = tmpVec3;

        var dx = size.x/2;
        var dy = size.y/2;

        tmp.set(-dx, -dy, 0).transformMat4(billboardMatrix).add(vec);
        this.project(tmp, tmp);

        var tlx = tmp.x;
        var tly = tmp.y;

        tmp.set(dx, dy, 0).transformMat4(billboardMatrix).add(vec);
        this.project(tmp, tmp);

        var brx = tmp.x;
        var bry = tmp.y;

        var w = Math.abs(brx - tlx);
        var h = Math.abs(bry - tly);
        return out.set(w, h);
    },

	update: function() {
		var aspect = this.viewportWidth / this.viewportHeight;

		//create a perspective matrix for our camera
		this.projection.perspective(this.fieldOfView, aspect, 
							Math.abs(this.near), Math.abs(this.far));

		//build the view matrix 
		tmpVec3.copy(this.position).add(this.direction);
		this.view.lookAt(this.position, tmpVec3, this.up);

		//projection * view matrix
		this.combined.copy(this.projection).mul(this.view);

		//invert combined matrix, used for unproject
		this.invProjectionView.copy(this.combined).invert();

        this.billboardMatrixDirty = true;
	}
});

module.exports = PerspectiveCamera;
},{"./Camera":3,"klasse":23,"vecmath":32}],6:[function(require,module,exports){
module.exports = {
	vecutil: require('./vecutil'),
	Camera: require('./Camera'),
    PerspectiveCamera: require('./PerspectiveCamera'),
    OrthographicCamera: require('./OrthographicCamera')
};
},{"./Camera":3,"./OrthographicCamera":4,"./PerspectiveCamera":5,"./vecutil":7}],7:[function(require,module,exports){

var Vector3 = require('vecmath').Vector3;
var Matrix4 = require('vecmath').Matrix4;
var Quaternion = require('vecmath').Quaternion;

var tmpMat4 = new Matrix4();
var tmpQuat = new Quaternion();
var tmpVec3 = new Vector3();

var util = {};

/**
 * Rotates a vector in place by axis angle.
 *
 * This is the same as transforming a point by an 
 * axis-angle quaternion, but it has higher precision.
 * 
 * @param  {Vector3} vec     [description]
 * @param  {Vector3} axis    [description]
 * @param  {float} radians [description]
 * @return {Vector3}         [description]
 */
util.rotate = function(vec, axis, radians) {
    //set the quaternion to our axis angle
    tmpQuat.setAxisAngle(axis, radians);

    //create a rotation matrix from the axis angle
    tmpMat4.fromRotationTranslation( tmpQuat, tmpVec3.set(0, 0, 0) );

    //multiply our vector by the rotation matrix
    return vec.transformMat4( tmpMat4 );
};

module.exports = util;
},{"vecmath":32}],8:[function(require,module,exports){
/*!
  * domready (c) Dustin Diaz 2014 - License MIT
  */
!function (name, definition) {

  if (typeof module != 'undefined') module.exports = definition()
  else if (typeof define == 'function' && typeof define.amd == 'object') define(definition)
  else this[name] = definition()

}('domready', function () {

  var fns = [], listener
    , doc = document
    , domContentLoaded = 'DOMContentLoaded'
    , loaded = /^loaded|^i|^c/.test(doc.readyState)

  if (!loaded)
  doc.addEventListener(domContentLoaded, listener = function () {
    doc.removeEventListener(domContentLoaded, listener)
    loaded = 1
    while (listener = fns.shift()) listener()
  })

  return function (fn) {
    loaded ? fn() : fns.push(fn)
  }

});

},{}],9:[function(require,module,exports){
module.exports = {
    MeshRenderer: require('./lib/MeshRenderer'),
};
},{"./lib/MeshRenderer":10}],10:[function(require,module,exports){
var Class = require('klasse');
var Mesh = require('kami').Mesh;
var ShaderProgram = require('kami').ShaderProgram;

var Matrix4 = require('vecmath').Matrix4;
var colorToFloat = require('number-util').colorToFloat;


////TODOS:
/// - use BaseBatch as a mixin for flush/begin/etc.
/// - rename to VertexRenderer? ImmediateModeRenderer?

/**
 * An immediate mode mesh renderer, mostly straight from LibGDX:
 * https://github.com/libgdx/libgdx/blob/master/gdx/src/com/badlogic/gdx/graphics/glutils/ImmediateModeRenderer20.java
 * 
 * This is mainly useful for prototyping.
 *
 * The options and their defaults:
 *
 * @class  MeshRenderer
 * @constructor
 * @param {WebGLContext} context the WebGLContext for management
 * @param {Object} options the optional set of options
 * @param {Boolean} options.hasNormals whether the renderer should write normals; default false
 * @param {Boolean} options.hasColors whether the renderer should write colors; default false
 * @param {Number} options.numTexCoords the number of texture coordinates to write. defaults to zero (no texcoords)
 * @param {Number} options.maxVertices the maximum number of vertices for this renderer, default 500
 */
var MeshRenderer = new Class({

    initialize: function(context, options) {
        this.context = context;
        if (!context)
            throw new Error("no WebGLContext specified to MeshRenderer");

        options = options || {};

        var hasNormals = typeof options.hasNormals !== "undefined" ? options.hasNormals : false;
        var hasColors = typeof options.hasColors !== "undefined" ? options.hasColors : false;
        this.numTexCoords = options.numTexCoords || 0;
        this.maxVertices = typeof options.maxVertices === "number" ? options.maxVertices : 500;

        var attribs = this._createVertexAttributes(hasNormals, hasColors);
        this.mesh = new Mesh(context, false, this.maxVertices, 0, attribs);

        //offset in FLOATS from start of vertex
        this.normalOffset = hasNormals ? 3 : 0;
        this.colorOffset = hasColors ? (this.normalOffset + 3) : 0;
        this.texCoordOffset = this.numTexCoords > 0 ? (this.colorOffset + 1) : 0;
        
        this.numSetTexCoords = 0;
        this.vertices = this.mesh.vertices;
        this.vertexSize = this.mesh.vertexStride / 4;

        this.primitiveType = context.gl.TRIANGLES;

        this.premultiplied = true;
        this.vertexIdx = 0;
        this.numVertices = 0;

        this.projModelView = new Matrix4();
        this._shader = MeshRenderer.createDefaultShader(context, hasNormals, hasColors, this.numTexCoords);


        /**
         * This shader will be used whenever "null" is passed
         * as the renderer's shader. 
         *
         * @property {ShaderProgram} shader
         */
        this.defaultShader = this._shader;

        /**
         * By default, a MeshRenderer is created with its own ShaderProgram,
         * stored in `defaultShader`. If this flag is true, on deleting the MeshRenderer, its
         * `defaultShader` will also be deleted. If this flag is false, no shaders
         * will be deleted on destroy.
         *
         * Note that if you re-assign `defaultShader`, you will need to dispose the previous
         * default shader yoursel. 
         *
         * @property ownsShader
         * @type {Boolean}
         */
        this.ownsShader = true;
    },


    destroy: function() {
        if (this.ownsShader && this.defaultShader)
            this.defaultShader.destroy();
        if (this.mesh)
            this.mesh.destroy();

        this.defaultShader = null;
        this._shader = null;
        this.mesh = null;
        this.context = null;
    },

    /**
     * This is a setter/getter for this renderer's current ShaderProgram.
     * 
     * If `null` or a falsy value is specified, the batch's `defaultShader` will be used. 
     *
     * Note that shaders are bound on renderer.begin().
     *
     * @property shader
     * @type {ShaderProgram}
     */
    shader: {
        set: function(val) {

            this._shader = val ? val : this.defaultShader;

            if (this.drawing) {
                this._shader.bind();
                this.uploadMatrices();
            }
        },

        get: function() {
            return this._shader;
        }
    },

    _createVertexAttributes: function(hasNormals, hasColors) {
        var gl = this.context.gl;
        var attribs = [
            new Mesh.Attrib(ShaderProgram.POSITION_ATTRIBUTE, 3)
        ];

        if (hasNormals)
            attribs.push( new Mesh.Attrib(ShaderProgram.NORMAL_ATTRIBUTE, 3) );
        if (hasColors)
            attribs.push( new Mesh.Attrib(ShaderProgram.COLOR_ATTRIBUTE, 4, null, gl.UNSIGNED_BYTE, true, 1) );

        for (var i = 0; i < this.numTexCoords; i++) {
            attribs.push( new Mesh.Attrib(ShaderProgram.TEXCOORD_ATTRIBUTE+i, 2) );
        }

        return attribs;
    },

    begin: function(projModelView, primitiveType) {
        if (this.drawing) 
            throw "batch.end() must be called before begin";
        this.drawing = true;

        if (projModelView)
            this.projModelView.set(projModelView);
        this.primitiveType = typeof primitiveType === "undefined" ? this.context.gl.TRIANGLES : primitiveType;

        var shader = this._shader;
        shader.bind();
        this.uploadMatrices();
    },

    uploadMatrices: function() {
        var shader = this._shader;
        shader.setUniformMatrix4("u_projModelView", this.projModelView);
        for (var i=0; i<this.numTexCoords; i++) {
            shader.setUniformi("u_sampler"+i, i);
        }
    },

    color: function(r, g, b, a) {
        var rnum = typeof r === "number";
        if (rnum
                && typeof g === "number"
                && typeof b === "number") {
            //default alpha to one 
            a = (a || a === 0) ? a : 1.0;
        } else {
            r = g = b = a = rnum ? r : 1.0;
        }
        

        if (this.premultiplied) {
            r *= a;
            g *= a;
            b *= a;
        }
        
        var color = colorToFloat(
            ~~(r * 255),
            ~~(g * 255),
            ~~(b * 255),
            ~~(a * 255)
        );
        this.vertices[ this.vertexIdx + this.colorOffset ] = color;
    },

    texCoord: function(u, v) {
        var idx = this.vertexIdx + this.texCoordOffset;
        this.vertices[ idx + this.numSetTexCoords ] = u || 0;
        this.vertices[ idx + this.numSetTexCoords + 1 ] = v || 0;
        this.numSetTexCoords += 2;
    },

    normal: function(x, y, z) {
        var idx = this.vertexIdx + this.normalOffset;
        this.vertices[ idx ] = x || 0;
        this.vertices[ idx + 1 ] = y || 0;
        this.vertices[ idx + 2 ] = z || 0;
    },

    vertex: function(x, y, z) {
        var idx = this.vertexIdx;
        this.vertices[ idx ] = x || 0;
        this.vertices[ idx + 1 ] = y || 0;
        this.vertices[ idx + 2 ] = z || 0;

        this.numSetTexCoords = 0;
        this.vertexIdx += this.vertexSize;
        this.numVertices++;
    },

    end: function() {
        //TODO: allow flushing and check for size like SpriteBatch
        if (!this.drawing)
            throw "renderer.begin() must be called before end";

        this.drawing = false;
        
        if (this.numVertices === 0)
            return;

        var shader = this._shader,
            gl = this.context.gl;

        this.mesh.bind(shader);

        this.mesh.verticesDirty = true;
        this.mesh.draw(this.primitiveType, this.vertexIdx * 4 / this.mesh.vertexStride, 0, this.vertexIdx);

        this.mesh.unbind(shader);

        this.numSetTexCoords = 0;
        this.vertexIdx = 0;
        this.numVertices = 0;
    }
});

//little shader builder from LibGDX..
MeshRenderer.createDefaultShader = function(context, hasNormals, hasColors, numTexCoords) {
    var vertSrc = MeshRenderer.createVertexShader(hasNormals, hasColors, numTexCoords);
    var fragSrc = MeshRenderer.createFragmentShader(hasColors, numTexCoords);
    return new ShaderProgram(context, vertSrc, fragSrc);
};

MeshRenderer.createVertexShader = function(hasNormals, hasColors, numTexCoords) {
    numTexCoords = numTexCoords || 0;
    var shader = "";
    shader += "attribute vec4 "+ShaderProgram.POSITION_ATTRIBUTE+";\n"
         + (hasNormals ? "attribute vec3 " + ShaderProgram.NORMAL_ATTRIBUTE + ";\n" : "")
         + (hasColors ? "attribute vec4 " + ShaderProgram.COLOR_ATTRIBUTE + ";\n" : "");

    var i;

    for (i = 0; i < numTexCoords; i++) {
        shader += "attribute vec2 " + ShaderProgram.TEXCOORD_ATTRIBUTE + i + ";\n";
    }

    shader += "uniform mat4 u_projModelView;\n";
    
    shader += (hasColors ? "varying vec4 v_col;\n" : "");

    for (i = 0; i < numTexCoords; i++) {
        shader += "varying vec2 v_tex" + i + ";\n";
    }

    shader += "void main() {\n" + "   gl_Position = u_projModelView * " + ShaderProgram.POSITION_ATTRIBUTE + ";\n"
            + (hasColors ? "   v_col = " + ShaderProgram.COLOR_ATTRIBUTE + ";\n" : "");

    for (i = 0; i < numTexCoords; i++) {
        shader += "   v_tex" + i + " = " + ShaderProgram.TEXCOORD_ATTRIBUTE + i + ";\n";
    }
    shader += "   gl_PointSize = 1.0;\n";
    shader += "}\n";

    return shader;
};

MeshRenderer.createFragmentShader = function(hasColors, numTexCoords) {
    numTexCoords = numTexCoords || 0;
    var shader = "#ifdef GL_ES\n" + "precision mediump float;\n" + "#endif\n";
 
    if (hasColors) 
        shader += "varying vec4 v_col;\n";

    var i;
    for (i = 0; i < numTexCoords; i++) {
            shader += "varying vec2 v_tex" + i + ";\n";
            shader += "uniform sampler2D u_sampler" + i + ";\n";
    }

    shader += "void main() {\n" + "   gl_FragColor = " + (hasColors ? "v_col" : "vec4(1, 1, 1, 1)");

    if (numTexCoords > 0) shader += " * ";

    for (i = 0; i < numTexCoords; i++) {
            if (i == numTexCoords - 1) {
                    shader += " texture2D(u_sampler" + i + ",  v_tex" + i + ")";
            } else {
                    shader += " texture2D(u_sampler" + i + ",  v_tex" + i + ") *";
            }
    }

    shader += ";\n}";
    return shader;
};

module.exports = MeshRenderer;
},{"kami":20,"klasse":23,"number-util":11,"vecmath":32}],11:[function(require,module,exports){
var int8 = new Int8Array(4);
var int32 = new Int32Array(int8.buffer, 0, 1);
var float32 = new Float32Array(int8.buffer, 0, 1);

/**
 * A singleton for number utilities. 
 * @class NumberUtil
 */
var NumberUtil = function() {

};


/**
 * Returns a float representation of the given int bits. ArrayBuffer
 * is used for the conversion.
 *
 * @method  intBitsToFloat
 * @static
 * @param  {Number} i the int to cast
 * @return {Number}   the float
 */
NumberUtil.intBitsToFloat = function(i) {
	int32[0] = i;
	return float32[0];
};

/**
 * Returns the int bits from the given float. ArrayBuffer is used
 * for the conversion.
 *
 * @method  floatToIntBits
 * @static
 * @param  {Number} f the float to cast
 * @return {Number}   the int bits
 */
NumberUtil.floatToIntBits = function(f) {
	float32[0] = f;
	return int32[0];
};

/**
 * Encodes ABGR int as a float, with slight precision loss.
 *
 * @method  intToFloatColor
 * @static
 * @param {Number} value an ABGR packed integer
 */
NumberUtil.intToFloatColor = function(value) {
	return NumberUtil.intBitsToFloat( value & 0xfeffffff );
};

/**
 * Returns a float encoded ABGR value from the given RGBA
 * bytes (0 - 255). Useful for saving bandwidth in vertex data.
 *
 * @method  colorToFloat
 * @static
 * @param {Number} r the Red byte (0 - 255)
 * @param {Number} g the Green byte (0 - 255)
 * @param {Number} b the Blue byte (0 - 255)
 * @param {Number} a the Alpha byte (0 - 255)
 * @return {Float32}  a Float32 of the RGBA color
 */
NumberUtil.colorToFloat = function(r, g, b, a) {
	var bits = (a << 24 | b << 16 | g << 8 | r);
	return NumberUtil.intToFloatColor(bits);
};

/**
 * Returns true if the number is a power-of-two.
 *
 * @method  isPowerOfTwo
 * @param  {Number}  n the number to test
 * @return {Boolean}   true if power-of-two
 */
NumberUtil.isPowerOfTwo = function(n) {
	return (n & (n - 1)) === 0;
};

/**
 * Returns the next highest power-of-two from the specified number. 
 * 
 * @param  {Number} n the number to test
 * @return {Number}   the next highest power of two
 */
NumberUtil.nextPowerOfTwo = function(n) {
	n--;
	n |= n >> 1;
	n |= n >> 2;
	n |= n >> 4;
	n |= n >> 8;
	n |= n >> 16;
	return n+1;
};

module.exports = NumberUtil;
},{}],12:[function(require,module,exports){
/**
 * The core kami module provides basic 2D sprite batching and 
 * asset management.
 * 
 * @module kami
 */

var Class = require('klasse');
var Mesh = require('./glutils/Mesh');

var colorToFloat = require('number-util').colorToFloat;

/** 
 * A batcher mixin composed of quads (two tris, indexed). 
 *
 * This is used internally; users should look at 
 * {{#crossLink "SpriteBatch"}}{{/crossLink}} instead, which inherits from this
 * class.
 * 
 * The batcher itself is not managed by WebGLContext; however, it makes
 * use of Mesh and Texture which will be managed. For this reason, the batcher
 * does not hold a direct reference to the GL state.
 *
 * Subclasses must implement the following:  
 * {{#crossLink "BaseBatch/_createShader:method"}}{{/crossLink}}  
 * {{#crossLink "BaseBatch/_createVertexAttributes:method"}}{{/crossLink}}  
 * {{#crossLink "BaseBatch/getVertexSize:method"}}{{/crossLink}}  
 * 
 * @class  BaseBatch
 * @constructor
 * @param {WebGLContext} context the context this batcher belongs to
 * @param {Number} size the optional size of this batch, i.e. max number of quads
 * @default  500
 */
var BaseBatch = new Class({

	//Constructor
	initialize: function BaseBatch(context, size) {
		if (typeof context !== "object")
			throw "GL context not specified to SpriteBatch";
		this.context = context;

		this.size = size || 500;
		
		// 65535 is max index, so 65535 / 6 = 10922.
		if (this.size > 10922)  //(you'd have to be insane to try and batch this much with WebGL)
			throw "Can't have more than 10922 sprites per batch: " + this.size;
				
		
		
		this._blendSrc = this.context.gl.ONE;
		this._blendDst = this.context.gl.ONE_MINUS_SRC_ALPHA
		this._blendingEnabled = true;
		this._shader = this._createShader();

		/**
		 * This shader will be used whenever "null" is passed
		 * as the batch's shader. 
		 *
		 * @property {ShaderProgram} shader
		 */
		this.defaultShader = this._shader;

		/**
		 * By default, a SpriteBatch is created with its own ShaderProgram,
		 * stored in `defaultShader`. If this flag is true, on deleting the SpriteBatch, its
		 * `defaultShader` will also be deleted. If this flag is false, no shaders
		 * will be deleted on destroy.
		 *
		 * Note that if you re-assign `defaultShader`, you will need to dispose the previous
		 * default shader yoursel. 
		 *
		 * @property ownsShader
		 * @type {Boolean}
		 */
		this.ownsShader = true;

		this.idx = 0;

		/**
		 * Whether we are currently drawing to the batch. Do not modify.
		 * 
		 * @property {Boolean} drawing
		 */
		this.drawing = false;

		this.mesh = this._createMesh(this.size);


		/**
		 * The ABGR packed color, as a single float. The default
		 * value is the color white (255, 255, 255, 255).
		 *
		 * @property {Number} color
		 * @readOnly 
		 */
		this.color = colorToFloat(255, 255, 255, 255);
		
		/**
		 * Whether to premultiply alpha on calls to setColor. 
		 * This is true by default, so that we can conveniently write:
		 *
		 *     batch.setColor(1, 0, 0, 0.25); //tints red with 25% opacity
		 *
		 * If false, you must premultiply the colors yourself to achieve
		 * the same tint, like so:
		 *
		 *     batch.setColor(0.25, 0, 0, 0.25);
		 * 
		 * @property premultiplied
		 * @type {Boolean}
		 * @default  true
		 */
		this.premultiplied = true;
	},

	/**
	 * A property to enable or disable blending for this sprite batch. If
	 * we are currently drawing, this will first flush the batch, and then
	 * update GL_BLEND state (enabled or disabled) with our new value.
	 * 
	 * @property {Boolean} blendingEnabled
	 */
	blendingEnabled: {
		set: function(val) {
			var old = this._blendingEnabled;
			if (this.drawing)
				this.flush();

			this._blendingEnabled = val;

			//if we have a new value, update it.
			//this is because blend is done in begin() / end() 
			if (this.drawing && old != val) {
				var gl = this.context.gl;
				if (val)
					gl.enable(gl.BLEND);
				else
					gl.disable(gl.BLEND);
			}

		},

		get: function() {
			return this._blendingEnabled;
		}
	},

	/**
	 * Sets the blend source parameters. 
	 * If we are currently drawing, this will flush the batch.
	 *
	 * Setting either src or dst to `null` or a falsy value tells the SpriteBatch
	 * to ignore gl.blendFunc. This is useful if you wish to use your
	 * own blendFunc or blendFuncSeparate. 
	 * 
	 * @property {GLenum} blendDst 
	 */
	blendSrc: {
		set: function(val) {
			if (this.drawing)
				this.flush();
			this._blendSrc = val;
		},

		get: function() {
			return this._blendSrc;
		}
	},

	/**
	 * Sets the blend destination parameters. 
	 * If we are currently drawing, this will flush the batch.
	 *
	 * Setting either src or dst to `null` or a falsy value tells the SpriteBatch
	 * to ignore gl.blendFunc. This is useful if you wish to use your
	 * own blendFunc or blendFuncSeparate. 
	 *
	 * @property {GLenum} blendSrc 
	 */
	blendDst: {
		set: function(val) {
			if (this.drawing)
				this.flush();
			this._blendDst = val;
		},

		get: function() {
			return this._blendDst;
		}
	},

	/**
	 * Sets the blend source and destination parameters. This is 
	 * a convenience function for the blendSrc and blendDst setters.
	 * If we are currently drawing, this will flush the batch.
	 *
	 * Setting either to `null` or a falsy value tells the SpriteBatch
	 * to ignore gl.blendFunc. This is useful if you wish to use your
	 * own blendFunc or blendFuncSeparate. 
	 *
	 * @method  setBlendFunction
	 * @param {GLenum} blendSrc the source blend parameter
	 * @param {GLenum} blendDst the destination blend parameter
	 */
	setBlendFunction: function(blendSrc, blendDst) {
		this.blendSrc = blendSrc;
		this.blendDst = blendDst;
	},

	/**
	 * This is a setter/getter for this batch's current ShaderProgram.
	 * If this is set when the batch is drawing, the state will be flushed
	 * to the GPU and the new shader will then be bound.
	 *
	 * If `null` or a falsy value is specified, the batch's `defaultShader` will be used. 
	 *
	 * Note that shaders are bound on batch.begin().
	 *
	 * @property shader
	 * @type {ShaderProgram}
	 */
	shader: {
		set: function(val) {
			var wasDrawing = this.drawing;

			if (wasDrawing) {
				this.end(); //unbinds the shader from the mesh
			}

			this._shader = val ? val : this.defaultShader;

			if (wasDrawing) {
				this.begin();
			}
		},

		get: function() {
			return this._shader;
		}
	},

	/**
	 * Sets the color of this sprite batcher, which is used in subsequent draw
	 * calls. This does not flush the batch.
	 *
	 * If r, g, b, are all numbers, this method assumes that RGB 
	 * or RGBA float values (0.0 to 1.0) are being passed. Alpha defaults to one
	 * if undefined.
	 * 
	 * If the first three arguments are not numbers, we only consider the first argument
	 * and assign it to all four components -- this is useful for setting transparency 
	 * in a premultiplied alpha stage. 
	 * 
	 * If the first argument is invalid or not a number,
	 * the color defaults to (1, 1, 1, 1).
	 *
	 * @method  setColor
	 * @param {Number} r the red component, normalized
	 * @param {Number} g the green component, normalized
	 * @param {Number} b the blue component, normalized
	 * @param {Number} a the alpha component, normalized
	 */
	setColor: function(r, g, b, a) {
		var rnum = typeof r === "number";
		if (rnum
				&& typeof g === "number"
				&& typeof b === "number") {
			//default alpha to one 
			a = (a || a === 0) ? a : 1.0;
		} else {
			r = g = b = a = rnum ? r : 1.0;
		}
		
		if (this.premultiplied) {
			r *= a;
			g *= a;
			b *= a;
		}
		
		this.color = colorToFloat(
			~~(r * 255),
			~~(g * 255),
			~~(b * 255),
			~~(a * 255)
		);
	},

	/**
	 * Called from the constructor to create a new Mesh 
	 * based on the expected batch size. Should set up
	 * verts & indices properly.
	 *
	 * Users should not call this directly; instead, it
	 * should only be implemented by subclasses.
	 * 
	 * @method _createMesh
	 * @param {Number} size the size passed through the constructor
	 */
	_createMesh: function(size) {
		//the total number of floats in our batch
		var numVerts = size * 4 * this.getVertexSize();
		//the total number of indices in our batch
		var numIndices = size * 6;
		var gl = this.context.gl;

		//vertex data
		this.vertices = new Float32Array(numVerts);
		//index data
		this.indices = new Uint16Array(numIndices); 
		
		for (var i=0, j=0; i < numIndices; i += 6, j += 4) 
		{
			this.indices[i + 0] = j + 0; 
			this.indices[i + 1] = j + 1;
			this.indices[i + 2] = j + 2;
			this.indices[i + 3] = j + 0;
			this.indices[i + 4] = j + 2;
			this.indices[i + 5] = j + 3;
		}

		var mesh = new Mesh(this.context, false, 
						numVerts, numIndices, this._createVertexAttributes());
		mesh.vertices = this.vertices;
		mesh.indices = this.indices;
		mesh.vertexUsage = gl.DYNAMIC_DRAW;
		mesh.indexUsage = gl.STATIC_DRAW;
		mesh.dirty = true;
		return mesh;
	},

	/**
	 * Returns a shader for this batch. If you plan to support
	 * multiple instances of your batch, it may or may not be wise
	 * to use a shared shader to save resources.
	 * 
	 * This method initially throws an error; so it must be overridden by
	 * subclasses of BaseBatch.
	 *
	 * @method  _createShader
	 * @return {Number} the size of a vertex, in # of floats
	 */
	_createShader: function() {
		throw "_createShader not implemented"
	},	

	/**
	 * Returns an array of vertex attributes for this mesh; 
	 * subclasses should implement this with the attributes 
	 * expected for their batch.
	 *
	 * This method initially throws an error; so it must be overridden by
	 * subclasses of BaseBatch.
	 *
	 * @method _createVertexAttributes
	 * @return {Array} an array of Mesh.VertexAttrib objects
	 */
	_createVertexAttributes: function() {
		throw "_createVertexAttributes not implemented";
	},


	/**
	 * Returns the number of floats per vertex for this batcher.
	 * 
	 * This method initially throws an error; so it must be overridden by
	 * subclasses of BaseBatch.
	 *
	 * @method  getVertexSize
	 * @return {Number} the size of a vertex, in # of floats
	 */
	getVertexSize: function() {
		throw "getVertexSize not implemented";
	},

	
	/** 
	 * Begins the sprite batch. This will bind the shader
	 * and mesh. Subclasses may want to disable depth or 
	 * set up blending.
	 *
	 * @method  begin
	 */
	begin: function()  {
		if (this.drawing) 
			throw "batch.end() must be called before begin";
		this.drawing = true;

		this.shader.bind();

		//bind the attributes now to avoid redundant calls
		this.mesh.bind(this.shader);

		if (this._blendingEnabled) {
			var gl = this.context.gl;
			gl.enable(gl.BLEND);
		}
	},

	/** 
	 * Ends the sprite batch. This will flush any remaining 
	 * data and set GL state back to normal.
	 * 
	 * @method  end
	 */
	end: function()  {
		if (!this.drawing)
			throw "batch.begin() must be called before end";
		if (this.idx > 0)
			this.flush();
		this.drawing = false;

		this.mesh.unbind(this.shader);

		if (this._blendingEnabled) {
			var gl = this.context.gl;
			gl.disable(gl.BLEND);
		}
	},

	/** 
	 * Called before rendering to bind new textures.
	 * This method does nothing by default.
	 *
	 * @method  _preRender
	 */
	_preRender: function()  {
	},

	/**
	 * Flushes the batch by pushing the current data
	 * to GL.
	 * 
	 * @method flush
	 */
	flush: function()  {
		if (this.idx===0)
			return;

		var gl = this.context.gl;

		//premultiplied alpha
		if (this._blendingEnabled) {
			//set either to null if you want to call your own 
			//blendFunc or blendFuncSeparate
			if (this._blendSrc && this._blendDst)
				gl.blendFunc(this._blendSrc, this._blendDst); 
		}

		this._preRender();

		//number of sprites in batch
		var numComponents = this.getVertexSize();
		var spriteCount = (this.idx / (numComponents * 4));
		
		//draw the sprites
		this.mesh.verticesDirty = true;
		this.mesh.draw(gl.TRIANGLES, spriteCount * 6, 0, this.idx);

		this.idx = 0;
	},

	/**
	 * Adds a sprite to this batch.
	 * The specifics depend on the sprite batch implementation.
	 *
	 * @method draw
	 * @param  {Texture} texture the texture for this sprite
	 * @param  {Number} x       the x position, defaults to zero
	 * @param  {Number} y       the y position, defaults to zero
	 * @param  {Number} width   the width, defaults to the texture width
	 * @param  {Number} height  the height, defaults to the texture height
	 * @param  {Number} u1      the first U coordinate, default zero
	 * @param  {Number} v1      the first V coordinate, default zero
	 * @param  {Number} u2      the second U coordinate, default one
	 * @param  {Number} v2      the second V coordinate, default one
	 */
	draw: function(texture, x, y, width, height, u1, v1, u2, v2) {
	},

	/**
	 * Adds a single quad mesh to this sprite batch from the given
	 * array of vertices.
	 * The specifics depend on the sprite batch implementation.
	 *
	 * @method  drawVertices
	 * @param {Texture} texture the texture we are drawing for this sprite
	 * @param {Float32Array} verts an array of vertices
	 * @param {Number} off the offset into the vertices array to read from
	 */
	drawVertices: function(texture, verts, off)  {
	},

	drawRegion: function(region, x, y, width, height) {
		this.draw(region.texture, x, y, width, height, region.u, region.v, region.u2, region.v2);
	},

	/**
	 * Destroys the batch, deleting its buffers and removing it from the
	 * WebGLContext management. Trying to use this
	 * batch after destroying it can lead to unpredictable behaviour.
	 *
	 * If `ownsShader` is true, this will also delete the `defaultShader` object.
	 * 
	 * @method destroy
	 */
	destroy: function() {
		this.vertices = null;
		this.indices = null;
		this.size = this.maxVertices = 0;

		if (this.ownsShader && this.defaultShader)
			this.defaultShader.destroy();
		this.defaultShader = null;
		this._shader = null; // remove reference to whatever shader is currently being used

		if (this.mesh) 
			this.mesh.destroy();
		this.mesh = null;
	}
});

module.exports = BaseBatch;

},{"./glutils/Mesh":18,"klasse":23,"number-util":21}],13:[function(require,module,exports){
/**
 * @module kami
 */

// Requires....
var Class         = require('klasse');

var BaseBatch = require('./BaseBatch');

var Mesh          = require('./glutils/Mesh');
var ShaderProgram = require('./glutils/ShaderProgram');

/**
 * A basic implementation of a batcher which draws 2D sprites.
 * This uses two triangles (quads) with indexed and interleaved
 * vertex data. Each vertex holds 5 floats (Position.xy, Color, TexCoord0.xy).
 *
 * The color is packed into a single float to reduce vertex bandwidth, and
 * the data is interleaved for best performance. We use a static index buffer,
 * and a dynamic vertex buffer that is updated with bufferSubData. 
 * 
 * @example
 *      var SpriteBatch = require('kami').SpriteBatch;  
 *      
 *      //create a new batcher
 *      var batch = new SpriteBatch(context);
 *
 *      function render() {
 *          batch.begin();
 *          
 *          //draw some sprites in between begin and end...
 *          batch.draw( texture, 0, 0, 25, 32 );
 *          batch.draw( texture1, 0, 25, 42, 23 );
 * 
 *          batch.end();
 *      }
 * 
 * @class  SpriteBatch
 * @uses BaseBatch
 * @constructor
 * @param {WebGLContext} context the context for this batch
 * @param {Number} size the max number of sprites to fit in a single batch
 */
var SpriteBatch = new Class({

	//inherit some stuff onto this prototype
	Mixins: BaseBatch,

	//Constructor
	initialize: function SpriteBatch(context, size) {
		BaseBatch.call(this, context, size);

		/**
		 * The projection Float32Array vec2 which is
		 * used to avoid some matrix calculations.
		 *
		 * @property projection
		 * @type {Float32Array}
		 */
		this.projection = new Float32Array(2);

		//Sets up a default projection vector so that the batch works without setProjection
		this.projection[0] = this.context.width/2;
		this.projection[1] = this.context.height/2;

		/**
		 * The currently bound texture. Do not modify.
		 * 
		 * @property {Texture} texture
		 * @readOnly
		 */
		this.texture = null;
	},

	/**
	 * This is a convenience function to set the batch's projection
	 * matrix to an orthographic 2D projection, based on the given screen
	 * size. This allows users to render in 2D without any need for a camera.
	 * 
	 * @param  {[type]} width  [description]
	 * @param  {[type]} height [description]
	 * @return {[type]}        [description]
	 */
	resize: function(width, height) {
		this.setProjection(width/2, height/2);
	},

	/**
	 * The number of floats per vertex for this batcher 
	 * (Position.xy + Color + TexCoord0.xy).
	 *
	 * @method  getVertexSize
	 * @return {Number} the number of floats per vertex
	 */
	getVertexSize: function() {
		return SpriteBatch.VERTEX_SIZE;
	},

	/**
	 * Used internally to return the Position, Color, and TexCoord0 attributes.
	 *
	 * @method  _createVertexAttribuets
	 * @protected
	 * @return {[type]} [description]
	 */
	_createVertexAttributes: function() {
		var gl = this.context.gl;

		return [ 
			new Mesh.Attrib(ShaderProgram.POSITION_ATTRIBUTE, 2),
			 //pack the color using some crazy wizardry 
			new Mesh.Attrib(ShaderProgram.COLOR_ATTRIBUTE, 4, null, gl.UNSIGNED_BYTE, true, 1),
			new Mesh.Attrib(ShaderProgram.TEXCOORD_ATTRIBUTE+"0", 2)
		];
	},


	/**
	 * Sets the projection vector, an x and y
	 * defining the middle points of your stage.
	 *
	 * @method setProjection
	 * @param {Number} x the x projection value
	 * @param {Number} y the y projection value
	 */
	setProjection: function(x, y) {
		var oldX = this.projection[0];
		var oldY = this.projection[1];
		this.projection[0] = x;
		this.projection[1] = y;

		//we need to flush the batch..
		if (this.drawing && (x != oldX || y != oldY)) {
			this.flush();
			this._updateMatrices();
		}
	},

	/**
	 * Creates a default shader for this batch.
	 *
	 * @method  _createShader
	 * @protected
	 * @return {ShaderProgram} a new instance of ShaderProgram
	 */
	_createShader: function() {
		var shader = new ShaderProgram(this.context,
				SpriteBatch.DEFAULT_VERT_SHADER, 
				SpriteBatch.DEFAULT_FRAG_SHADER);
		if (shader.log)
			console.warn("Shader Log:\n" + shader.log);
		return shader;
	},

	/**
	 * This is called during rendering to update projection/transform
	 * matrices and upload the new values to the shader. For example,
	 * if the user calls setProjection mid-draw, the batch will flush
	 * and this will be called before continuing to add items to the batch.
	 *
	 * You generally should not need to call this directly.
	 * 
	 * @method  updateMatrices
	 * @protected
	 */
	updateMatrices: function() {
		this.shader.setUniformfv("u_projection", this.projection);
	},

	/**
	 * Called before rendering, and binds the current texture.
	 * 
	 * @method _preRender
	 * @protected
	 */
	_preRender: function() {
		if (this.texture)
			this.texture.bind();
	},

	/**
	 * Binds the shader, disables depth writing, 
	 * enables blending, activates texture unit 0, and sends
	 * default matrices and sampler2D uniforms to the shader.
	 *
	 * @method  begin
	 */
	begin: function() {
		//sprite batch doesn't hold a reference to GL since it is volatile
		var gl = this.context.gl;
		
		//This binds the shader and mesh!
		BaseBatch.prototype.begin.call(this);

		this.updateMatrices(); //send projection/transform to shader

		//upload the sampler uniform. not necessary every flush so we just
		//do it here.
		this.shader.setUniformi("u_texture0", 0);

		//disable depth mask
		gl.depthMask(false);
	},

	/**
	 * Ends the sprite batcher and flushes any remaining data to the GPU.
	 * 
	 * @method end
	 */
	end: function() {
		//sprite batch doesn't hold a reference to GL since it is volatile
		var gl = this.context.gl;
		
		//just do direct parent call for speed here
		//This binds the shader and mesh!
		BaseBatch.prototype.end.call(this);

		gl.depthMask(true);
	},

	/**
	 * Flushes the batch to the GPU. This should be called when
	 * state changes, such as blend functions, depth or stencil states,
	 * shaders, and so forth.
	 * 
	 * @method flush
	 */
	flush: function() {
		//ignore flush if texture is null or our batch is empty
		if (!this.texture)
			return;
		if (this.idx === 0)
			return;
		BaseBatch.prototype.flush.call(this);
		SpriteBatch.totalRenderCalls++;
	},

	/**
	 * Adds a sprite to this batch. The sprite is drawn in 
	 * screen-space with the origin at the upper-left corner (y-down).
	 * 
	 * @method draw
	 * @param  {Texture} texture the Texture
	 * @param  {Number} x       the x position in pixels, defaults to zero
	 * @param  {Number} y       the y position in pixels, defaults to zero
	 * @param  {Number} width   the width in pixels, defaults to the texture width
	 * @param  {Number} height  the height in pixels, defaults to the texture height
	 * @param  {Number} u1      the first U coordinate, default zero
	 * @param  {Number} v1      the first V coordinate, default zero
	 * @param  {Number} u2      the second U coordinate, default one
	 * @param  {Number} v2      the second V coordinate, default one
	 */
	draw: function(texture, x, y, width, height, u1, v1, u2, v2) {
		if (!this.drawing)
			throw "Illegal State: trying to draw a batch before begin()";

		//don't draw anything if GL tex doesn't exist..
		if (!texture)
			return;

		if (this.texture === null || this.texture.id !== texture.id) {
			//new texture.. flush previous data
			this.flush();
			this.texture = texture;
		} else if (this.idx == this.vertices.length) {
			this.flush(); //we've reached our max, flush before pushing more data
		}

		width = (width===0) ? width : (width || texture.width);
		height = (height===0) ? height : (height || texture.height);
		x = x || 0;
		y = y || 0;

		var x1 = x;
		var x2 = x + width;
		var y1 = y;
		var y2 = y + height;

		u1 = u1 || 0;
		u2 = (u2===0) ? u2 : (u2 || 1);
		v1 = v1 || 0;
		v2 = (v2===0) ? v2 : (v2 || 1);

		var c = this.color;

		//xy
		this.vertices[this.idx++] = x1;
		this.vertices[this.idx++] = y1;
		//color
		this.vertices[this.idx++] = c;
		//uv
		this.vertices[this.idx++] = u1;
		this.vertices[this.idx++] = v1;
		
		//xy
		this.vertices[this.idx++] = x2;
		this.vertices[this.idx++] = y1;
		//color
		this.vertices[this.idx++] = c;
		//uv
		this.vertices[this.idx++] = u2;
		this.vertices[this.idx++] = v1;

		//xy
		this.vertices[this.idx++] = x2;
		this.vertices[this.idx++] = y2;
		//color
		this.vertices[this.idx++] = c;
		//uv
		this.vertices[this.idx++] = u2;
		this.vertices[this.idx++] = v2;

		//xy
		this.vertices[this.idx++] = x1;
		this.vertices[this.idx++] = y2;
		//color
		this.vertices[this.idx++] = c;
		//uv
		this.vertices[this.idx++] = u1;
		this.vertices[this.idx++] = v2;
	},

	/**
	 * Adds a single quad mesh to this sprite batch from the given
	 * array of vertices. The sprite is drawn in 
	 * screen-space with the origin at the upper-left corner (y-down).
	 *
	 * This reads 20 interleaved floats from the given offset index, in the format
	 *
	 *  { x, y, color, u, v,
	 *      ...  }
	 *
	 * @method  drawVertices
	 * @param {Texture} texture the Texture object
	 * @param {Float32Array} verts an array of vertices
	 * @param {Number} off the offset into the vertices array to read from
	 */
	drawVertices: function(texture, verts, off) {
		if (!this.drawing)
			throw "Illegal State: trying to draw a batch before begin()";
		
		//don't draw anything if GL tex doesn't exist..
		if (!texture)
			return;


		if (this.texture != texture) {
			//new texture.. flush previous data
			this.flush();
			this.texture = texture;
		} else if (this.idx == this.vertices.length) {
			this.flush(); //we've reached our max, flush before pushing more data
		}

		off = off || 0;
		//TODO: use a loop here?
		//xy
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		//color
		this.vertices[this.idx++] = verts[off++];
		//uv
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		
		//xy
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		//color
		this.vertices[this.idx++] = verts[off++];
		//uv
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];

		//xy
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		//color
		this.vertices[this.idx++] = verts[off++];
		//uv
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];

		//xy
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		//color
		this.vertices[this.idx++] = verts[off++];
		//uv
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
	}
});

/**
 * The default vertex size, i.e. number of floats per vertex.
 * @attribute  VERTEX_SIZE
 * @static
 * @final
 * @type {Number}
 * @default  5
 */
SpriteBatch.VERTEX_SIZE = 5;

/**
 * Incremented after each draw call, can be used for debugging.
 *
 *     SpriteBatch.totalRenderCalls = 0;
 *
 *     ... draw your scene ...
 *
 *     console.log("Draw calls per frame:", SpriteBatch.totalRenderCalls);
 *
 * 
 * @attribute  totalRenderCalls
 * @static
 * @type {Number}
 * @default  0
 */
SpriteBatch.totalRenderCalls = 0;

SpriteBatch.DEFAULT_FRAG_SHADER = [
	"precision mediump float;",
	"varying vec2 vTexCoord0;",
	"varying vec4 vColor;",
	"uniform sampler2D u_texture0;",

	"void main(void) {",
	"   gl_FragColor = texture2D(u_texture0, vTexCoord0) * vColor;",
	"}"
].join('\n');

SpriteBatch.DEFAULT_VERT_SHADER = [
	"attribute vec2 "+ShaderProgram.POSITION_ATTRIBUTE+";",
	"attribute vec4 "+ShaderProgram.COLOR_ATTRIBUTE+";",
	"attribute vec2 "+ShaderProgram.TEXCOORD_ATTRIBUTE+"0;",

	"uniform vec2 u_projection;",
	"varying vec2 vTexCoord0;",
	"varying vec4 vColor;",

	"void main(void) {", ///TODO: use a projection and transform matrix
	"   gl_Position = vec4( "
		+ShaderProgram.POSITION_ATTRIBUTE
		+".x / u_projection.x - 1.0, "
		+ShaderProgram.POSITION_ATTRIBUTE
		+".y / -u_projection.y + 1.0 , 0.0, 1.0);",
	"   vTexCoord0 = "+ShaderProgram.TEXCOORD_ATTRIBUTE+"0;",
	"   vColor = "+ShaderProgram.COLOR_ATTRIBUTE+";",
	"}"
].join('\n');

module.exports = SpriteBatch;

},{"./BaseBatch":12,"./glutils/Mesh":18,"./glutils/ShaderProgram":19,"klasse":23}],14:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');
var Signal = require('signals');
var nextPowerOfTwo = require('number-util').nextPowerOfTwo;
var isPowerOfTwo = require('number-util').isPowerOfTwo;

var Texture = new Class({


	/**
	 * Creates a new texture with the optional width, height, and data.
	 *
	 * If the constructor is passed no parameters other than WebGLContext, then
	 * it will not be initialized and will be non-renderable. You will need to manually
	 * uploadData or uploadImage yourself.
	 *
	 * If you pass a width and height after context, the texture will be initialized with that size
	 * and null data (e.g. transparent black). If you also pass the format and data, 
	 * it will be uploaded to the texture. 
	 *
	 * If you pass a String or Data URI as the second parameter,
	 * this Texture will load an Image object asynchronously. The optional third
	 * and fourth parameters are callback functions for success and failure, respectively. 
	 * The optional fifrth parameter for this version of the constructor is genMipmaps, which defaults to false. 
	 * 
	 * The arguments are kept in memory for future context restoration events. If
	 * this is undesirable (e.g. huge buffers which need to be GC'd), you should not
	 * pass the data in the constructor, but instead upload it after creating an uninitialized 
	 * texture. You will need to manage it yourself, either by extending the create() method, 
	 * or listening to restored events in WebGLContext.
	 *
	 * Most users will want to use the AssetManager to create and manage their textures
	 * with asynchronous loading and context loss. 
	 *
	 * @example
	 * 		new Texture(context, 256, 256); //empty 256x256 texture
	 * 		new Texture(context, 1, 1, Texture.Format.RGBA, Texture.DataType.UNSIGNED_BYTE, 
	 * 					new Uint8Array([255,0,0,255])); //1x1 red texture
	 * 		new Texture(context, "test.png"); //loads image asynchronously
	 * 		new Texture(context, "test.png", successFunc, failFunc, useMipmaps); //extra params for image laoder 
	 *
	 * @class  Texture
	 * @constructor
	 * @param  {WebGLContext} context the WebGL context
	 * @param  {Number} width the width of this texture
	 * @param  {Number} height the height of this texture
	 * @param  {GLenum} format e.g. Texture.Format.RGBA
	 * @param  {GLenum} dataType e.g. Texture.DataType.UNSIGNED_BYTE (Uint8Array)
	 * @param  {GLenum} data the array buffer, e.g. a Uint8Array view
	 * @param  {Boolean} genMipmaps whether to generate mipmaps after uploading the data
	 */
	initialize: function Texture(context, width, height, format, dataType, data, genMipmaps) {
		if (typeof context !== "object")
			throw "GL context not specified to Texture";
		this.context = context;

		/**
		 * The WebGLTexture which backs this Texture object. This
		 * can be used for low-level GL calls.
		 * 
		 * @type {WebGLTexture}
		 */
		this.id = null; //initialized in create()

		/**
		 * The target for this texture unit, i.e. TEXTURE_2D. Subclasses
		 * should override the create() method to change this, for correct
		 * usage with context restore.
		 * 
		 * @property target
		 * @type {GLenum}
		 * @default  gl.TEXTURE_2D
		 */
		this.target = context.gl.TEXTURE_2D;

		/**
		 * The width of this texture, in pixels.
		 * 
		 * @property width
		 * @readOnly
		 * @type {Number} the width
		 */
		this.width = 0; //initialized on texture upload

		/**
		 * The height of this texture, in pixels.
		 * 
		 * @property height
		 * @readOnly
		 * @type {Number} the height
		 */
		this.height = 0; //initialized on texture upload

		// e.g. --> new Texture(gl, 256, 256, gl.RGB, gl.UNSIGNED_BYTE, data);
		//		      creates a new empty texture, 256x256
		//		--> new Texture(gl);
		//			  creates a new texture but WITHOUT uploading any data. 

		/**
		 * The S wrap parameter.
		 * @property {GLenum} wrapS
		 */
		this.wrapS = Texture.DEFAULT_WRAP;
		/**
		 * The T wrap parameter.
		 * @property {GLenum} wrapT
		 */
		this.wrapT = Texture.DEFAULT_WRAP;
		/**
		 * The minifcation filter.
		 * @property {GLenum} minFilter 
		 */
		this.minFilter = Texture.DEFAULT_FILTER;
		
		/**
		 * The magnification filter.
		 * @property {GLenum} magFilter 
		 */
		this.magFilter = Texture.DEFAULT_FILTER;

		/**
		 * When a texture is created, we keep track of the arguments provided to 
		 * its constructor. On context loss and restore, these arguments are re-supplied
		 * to the Texture, so as to re-create it in its correct form.
		 *
		 * This is mainly useful if you are procedurally creating textures and passing
		 * their data directly (e.g. for generic lookup tables in a shader). For image
		 * or media based textures, it would be better to use an AssetManager to manage
		 * the asynchronous texture upload.
		 *
		 * Upon destroying a texture, a reference to this is also lost.
		 *
		 * @property managedArgs
		 * @type {Array} the array of arguments, shifted to exclude the WebGLContext parameter
		 */
		this.managedArgs = Array.prototype.slice.call(arguments, 1);

		//This is maanged by WebGLContext
		this.context.addManagedObject(this);
		this.create();
	},

	/**
	 * This can be called after creating a Texture to load an Image object asynchronously,
	 * or upload image data directly. It takes the same parameters as the constructor, except 
	 * for the context which has already been established. 
	 *
	 * Users will generally not need to call this directly. 
	 * 
	 * @protected
	 * @method  setup
	 */
	setup: function(width, height, format, dataType, data, genMipmaps) {
		var gl = this.gl;

		//If the first argument is a string, assume it's an Image loader
		//second argument will then be genMipmaps, third and fourth the success/fail callbacks
		if (typeof width === "string") {
			var img = new Image();
			var path      = arguments[0];   //first argument, the path
			var successCB = typeof arguments[1] === "function" ? arguments[1] : null;
			var failCB    = typeof arguments[2] === "function" ? arguments[2] : null;
			genMipmaps    = !!arguments[3];

			var self = this;

			//If you try to render a texture that is not yet "renderable" (i.e. the 
			//async load hasn't completed yet, which is always the case in Chrome since requestAnimationFrame
			//fires before img.onload), WebGL will throw us errors. So instead we will just upload some
			//dummy data until the texture load is complete. Users can disable this with the global flag.
			if (Texture.USE_DUMMY_1x1_DATA) {
				self.uploadData(1, 1);
				this.width = this.height = 0;
			}

			img.onload = function() {
				self.uploadImage(img, undefined, undefined, genMipmaps);
				if (successCB)
					successCB();
			}
			img.onerror = function() {
				// console.warn("Error loading image: "+path);
				if (genMipmaps) //we still need to gen mipmaps on the 1x1 dummy
					gl.generateMipmap(gl.TEXTURE_2D);
				if (failCB)
					failCB();
			}
			img.onabort = function() {
				// console.warn("Image load aborted: "+path);
				if (genMipmaps) //we still need to gen mipmaps on the 1x1 dummy
					gl.generateMipmap(gl.TEXTURE_2D);
				if (failCB)
					failCB();
			}

			img.src = path;
		} 
		//otherwise assume our regular list of width/height arguments are passed
		else {
			this.uploadData(width, height, format, dataType, data, genMipmaps);
		}
	},	

	/**
	 * Called in the Texture constructor, and after the GL context has been re-initialized. 
	 * Subclasses can override this to provide a custom data upload, e.g. cubemaps or compressed
	 * textures.
	 *
	 * @method  create
	 */
	create: function() {
		this.gl = this.context.gl; 
		var gl = this.gl;

		this.id = gl.createTexture(); //texture ID is recreated
		this.width = this.height = 0; //size is reset to zero until loaded
		this.target = gl.TEXTURE_2D;  //the provider can change this if necessary (e.g. cube maps)

		this.bind();


		//TODO: clean these up a little. 
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, Texture.UNPACK_PREMULTIPLY_ALPHA);
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, Texture.UNPACK_ALIGNMENT);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, Texture.UNPACK_FLIP_Y);
		
		var colorspace = Texture.UNPACK_COLORSPACE_CONVERSION || gl.BROWSER_DEFAULT_WEBGL;
		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, colorspace);

		//setup wrap modes without binding redundantly
		this.setWrap(this.wrapS, this.wrapT, false);
		this.setFilter(this.minFilter, this.magFilter, false);
		
		if (this.managedArgs.length !== 0) {
			this.setup.apply(this, this.managedArgs);
		}
	},

	/**
	 * Destroys this texture by deleting the GL resource,
	 * removing it from the WebGLContext management stack,
	 * setting its size to zero, and id and managed arguments to null.
	 * 
	 * Trying to use this texture after may lead to undefined behaviour.
	 *
	 * @method  destroy
	 */
	destroy: function() {
		if (this.id && this.gl)
			this.gl.deleteTexture(this.id);
		if (this.context)
			this.context.removeManagedObject(this);
		this.width = this.height = 0;
		this.id = null;
		this.managedArgs = null;
		this.context = null;
		this.gl = null;
	},

	/**
	 * Sets the wrap mode for this texture; if the second argument
	 * is undefined or falsy, then both S and T wrap will use the first
	 * argument.
	 *
	 * You can use Texture.Wrap constants for convenience, to avoid needing 
	 * a GL reference.
	 *
	 * @method  setWrap
	 * @param {GLenum} s the S wrap mode
	 * @param {GLenum} t the T wrap mode
	 * @param {Boolean} ignoreBind (optional) if true, the bind will be ignored. 
	 */
	setWrap: function(s, t, ignoreBind) { //TODO: support R wrap mode
		if (s && t) {
			this.wrapS = s;
			this.wrapT = t;
		} else 
			this.wrapS = this.wrapT = s;
		
		//enforce POT rules..
		this._checkPOT();	

		if (!ignoreBind)
			this.bind();

		var gl = this.gl;
		gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, this.wrapS);
		gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, this.wrapT);
	},


	/**
	 * Sets the min and mag filter for this texture; 
	 * if mag is undefined or falsy, then both min and mag will use the
	 * filter specified for min.
	 *
	 * You can use Texture.Filter constants for convenience, to avoid needing 
	 * a GL reference.
	 *
	 * @method  setFilter
	 * @param {GLenum} min the minification filter
	 * @param {GLenum} mag the magnification filter
	 * @param {Boolean} ignoreBind if true, the bind will be ignored. 
	 */
	setFilter: function(min, mag, ignoreBind) { 
		if (min && mag) {
			this.minFilter = min;
			this.magFilter = mag;
		} else 
			this.minFilter = this.magFilter = min;
		
		//enforce POT rules..
		this._checkPOT();

		if (!ignoreBind)
			this.bind();

		var gl = this.gl;
		gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, this.minFilter);
		gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, this.magFilter);
	},

	/**
	 * A low-level method to upload the specified ArrayBufferView
	 * to this texture. This will cause the width and height of this
	 * texture to change.
	 *
	 * @method  uploadData
	 * @param  {Number} width          the new width of this texture,
	 *                                 defaults to the last used width (or zero)
	 * @param  {Number} height         the new height of this texture
	 *                                 defaults to the last used height (or zero)
	 * @param  {GLenum} format         the data format, default RGBA
	 * @param  {GLenum} type           the data type, default UNSIGNED_BYTE (Uint8Array)
	 * @param  {ArrayBufferView} data  the raw data for this texture, or null for an empty image
	 * @param  {Boolean} genMipmaps	   whether to generate mipmaps after uploading the data, default false
	 */
	uploadData: function(width, height, format, type, data, genMipmaps) {
		var gl = this.gl;

		format = format || gl.RGBA;
		type = type || gl.UNSIGNED_BYTE;
		data = data || null; //make sure falsey value is null for texImage2D

		this.width = (width || width==0) ? width : this.width;
		this.height = (height || height==0) ? height : this.height;

		this._checkPOT();

		this.bind();

		gl.texImage2D(this.target, 0, format, 
					  this.width, this.height, 0, format,
					  type, data);

		if (genMipmaps)
			gl.generateMipmap(this.target);
	},

	/**
	 * Uploads ImageData, HTMLImageElement, HTMLCanvasElement or 
	 * HTMLVideoElement.
	 *
	 * @method  uploadImage
	 * @param  {Object} domObject the DOM image container
	 * @param  {GLenum} format the format, default gl.RGBA
	 * @param  {GLenum} type the data type, default gl.UNSIGNED_BYTE
	 * @param  {Boolean} genMipmaps whether to generate mipmaps after uploading the data, default false
	 */
	uploadImage: function(domObject, format, type, genMipmaps) {
		var gl = this.gl;

		format = format || gl.RGBA;
		type = type || gl.UNSIGNED_BYTE;
		
		this.width = domObject.width;
		this.height = domObject.height;

		this._checkPOT();

		this.bind();

		gl.texImage2D(this.target, 0, format, format,
					  type, domObject);

		if (genMipmaps)
			gl.generateMipmap(this.target);
	},

	/**
	 * If FORCE_POT is false, we verify this texture to see if it is valid, 
	 * as per non-power-of-two rules. If it is non-power-of-two, it must have 
	 * a wrap mode of CLAMP_TO_EDGE, and the minification filter must be LINEAR
	 * or NEAREST. If we don't satisfy these needs, an error is thrown.
	 * 
	 * @method  _checkPOT
	 * @private
	 * @return {[type]} [description]
	 */
	_checkPOT: function() {
		if (!Texture.FORCE_POT) {
			//If minFilter is anything but LINEAR or NEAREST
			//or if wrapS or wrapT are not CLAMP_TO_EDGE...
			var wrongFilter = (this.minFilter !== Texture.Filter.LINEAR && this.minFilter !== Texture.Filter.NEAREST);
			var wrongWrap = (this.wrapS !== Texture.Wrap.CLAMP_TO_EDGE || this.wrapT !== Texture.Wrap.CLAMP_TO_EDGE);

			if ( wrongFilter || wrongWrap ) {
				if (!isPowerOfTwo(this.width) || !isPowerOfTwo(this.height))
					throw new Error(wrongFilter 
							? "Non-power-of-two textures cannot use mipmapping as filter"
							: "Non-power-of-two textures must use CLAMP_TO_EDGE as wrap");
			}
		}
	},

	/**
	 * Binds the texture. If unit is specified,
	 * it will bind the texture at the given slot
	 * (TEXTURE0, TEXTURE1, etc). If unit is not specified,
	 * it will simply bind the texture at whichever slot
	 * is currently active.
	 *
	 * @method  bind
	 * @param  {Number} unit the texture unit index, starting at 0
	 */
	bind: function(unit) {
		var gl = this.gl;
		if (unit || unit === 0)
			gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(this.target, this.id);
	},

	toString: function() {
		return this.id + ":" + this.width + "x" + this.height + "";
	}
});

/** 
 * A set of Filter constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.Filter.NEAREST
 *     Texture.Filter.NEAREST_MIPMAP_LINEAR
 *     Texture.Filter.NEAREST_MIPMAP_NEAREST
 *     Texture.Filter.LINEAR
 *     Texture.Filter.LINEAR_MIPMAP_LINEAR
 *     Texture.Filter.LINEAR_MIPMAP_NEAREST
 * ```
 * @attribute Filter
 * @static
 * @type {Object}
 */
Texture.Filter = {
	NEAREST: 9728,
	NEAREST_MIPMAP_LINEAR: 9986,
	NEAREST_MIPMAP_NEAREST: 9984,
	LINEAR: 9729,
	LINEAR_MIPMAP_LINEAR: 9987,
	LINEAR_MIPMAP_NEAREST: 9985
};

/** 
 * A set of Wrap constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.Wrap.CLAMP_TO_EDGE
 *     Texture.Wrap.MIRRORED_REPEAT
 *     Texture.Wrap.REPEAT
 * ```
 * @attribute Wrap
 * @static
 * @type {Object}
 */
Texture.Wrap = {
	CLAMP_TO_EDGE: 33071,
	MIRRORED_REPEAT: 33648,
	REPEAT: 10497
};

/** 
 * A set of Format constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.Format.RGB
 *     Texture.Format.RGBA
 *     Texture.Format.LUMINANCE_ALPHA
 * ```
 * @attribute Format
 * @static
 * @type {Object}
 */
Texture.Format = {
	DEPTH_COMPONENT: 6402,
	ALPHA: 6406,
	RGBA: 6408,
	RGB: 6407,
	LUMINANCE: 6409,
	LUMINANCE_ALPHA: 6410
};

/** 
 * A set of DataType constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.DataType.UNSIGNED_BYTE 
 *     Texture.DataType.FLOAT 
 * ```
 * @attribute DataType
 * @static
 * @type {Object}
 */
Texture.DataType = {
	BYTE: 5120,
	SHORT: 5122,
	INT: 5124,
	FLOAT: 5126,
	UNSIGNED_BYTE: 5121,
	UNSIGNED_INT: 5125,
	UNSIGNED_SHORT: 5123,
	UNSIGNED_SHORT_4_4_4_4: 32819,
	UNSIGNED_SHORT_5_5_5_1: 32820,
	UNSIGNED_SHORT_5_6_5: 33635
}

/**
 * The default wrap mode when creating new textures. If a custom 
 * provider was specified, it may choose to override this default mode.
 * 
 * @attribute {GLenum} DEFAULT_WRAP
 * @static 
 * @default  Texture.Wrap.CLAMP_TO_EDGE
 */
Texture.DEFAULT_WRAP = Texture.Wrap.CLAMP_TO_EDGE;


/**
 * The default filter mode when creating new textures. If a custom
 * provider was specified, it may choose to override this default mode.
 *
 * @attribute {GLenum} DEFAULT_FILTER
 * @static
 * @default  Texture.Filter.LINEAR
 */
Texture.DEFAULT_FILTER = Texture.Filter.NEAREST;

/**
 * By default, we do some error checking when creating textures
 * to ensure that they will be "renderable" by WebGL. Non-power-of-two
 * textures must use CLAMP_TO_EDGE as their wrap mode, and NEAREST or LINEAR
 * as their wrap mode. Further, trying to generate mipmaps for a NPOT image
 * will lead to errors. 
 *
 * However, you can disable this error checking by setting `FORCE_POT` to true.
 * This may be useful if you are running on specific hardware that supports POT 
 * textures, or in some future case where NPOT textures is added as a WebGL extension.
 * 
 * @attribute {Boolean} FORCE_POT
 * @static
 * @default  false
 */
Texture.FORCE_POT = false;

//default pixel store operations. Used in create()
Texture.UNPACK_FLIP_Y = false;
Texture.UNPACK_ALIGNMENT = 1;
Texture.UNPACK_PREMULTIPLY_ALPHA = true; 
Texture.UNPACK_COLORSPACE_CONVERSION = undefined;

//for the Image constructor we need to handle things a bit differently..
Texture.USE_DUMMY_1x1_DATA = true;

/**
 * Utility to get the number of components for the given GLenum, e.g. gl.RGBA returns 4.
 * Returns null if the specified format is not of type DEPTH_COMPONENT, ALPHA, LUMINANCE,
 * LUMINANCE_ALPHA, RGB, or RGBA.
 * 
 * @method getNumComponents
 * @static
 * @param  {GLenum} format a texture format, i.e. Texture.Format.RGBA
 * @return {Number} the number of components for this format
 */
Texture.getNumComponents = function(format) {
	switch (format) {
		case Texture.Format.DEPTH_COMPONENT:
		case Texture.Format.ALPHA:
		case Texture.Format.LUMINANCE:
			return 1;
		case Texture.Format.LUMINANCE_ALPHA:
			return 2;
		case Texture.Format.RGB:
			return 3;
		case Texture.Format.RGBA:
			return 4;
	}
	return null;
};

module.exports = Texture;
},{"klasse":23,"number-util":21,"signals":22}],15:[function(require,module,exports){
var Class = require('klasse');
var Texture = require('./Texture');

//This is a GL-specific texture region, employing tangent space normalized coordinates U and V.
//A canvas-specific region would really just be a lightweight object with { x, y, width, height }
//in pixels.
var TextureRegion = new Class({

	initialize: function TextureRegion(texture, x, y, width, height) {
		this.texture = texture;
		this.setRegion(x, y, width, height);
	},

	setUVs: function(u, v, u2, v2) {
		this.regionWidth = Math.round(Math.abs(u2 - u) * this.texture.width);
        this.regionHeight = Math.round(Math.abs(v2 - v) * this.texture.height);

        // From LibGDX TextureRegion.java -- 
		// For a 1x1 region, adjust UVs toward pixel center to avoid filtering artifacts on AMD GPUs when drawing very stretched.
		if (this.regionWidth == 1 && this.regionHeight == 1) {
			var adjustX = 0.25 / this.texture.width;
			u += adjustX;
			u2 -= adjustX;
			var adjustY = 0.25 / this.texture.height;
			v += adjustY;
			v2 -= adjustY;
		}

		this.u = u;
		this.v = v;
		this.u2 = u2;
		this.v2 = v2;
	},

	setRegion: function(x, y, width, height) {
		x = x || 0;
		y = y || 0;
		width = (width===0 || width) ? width : this.texture.width;
		height = (height===0 || height) ? height : this.texture.height;

		var invTexWidth = 1 / this.texture.width;
		var invTexHeight = 1 / this.texture.height;
		this.setUVs(x * invTexWidth, y * invTexHeight, (x + width) * invTexWidth, (y + height) * invTexHeight);
		this.regionWidth = Math.abs(width);
		this.regionHeight = Math.abs(height);
	},

	/** Sets the texture to that of the specified region and sets the coordinates relative to the specified region. */
	setFromRegion: function(region, x, y, width, height) {
		this.texture = region.texture;
		this.set(region.getRegionX() + x, region.getRegionY() + y, width, height);
	},


	//TODO: add setters for regionX/Y and regionWidth/Height

	regionX: {
		get: function() {
			return Math.round(this.u * this.texture.width);
		} 
	},

	regionY: {
		get: function() {
			return Math.round(this.v * this.texture.height);
		}
	},

	flip: function(x, y) {
		var temp;
		if (x) {
			temp = this.u;
			this.u = this.u2;
			this.u2 = temp;
		}
		if (y) {
			temp = this.v;
			this.v = this.v2;
			this.v2 = temp;
		}
	}
});

module.exports = TextureRegion;
},{"./Texture":14,"klasse":23}],16:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');
var Signal = require('signals');

/**
 * A thin wrapper around WebGLRenderingContext which handles
 * context loss and restore with various rendering objects (textures,
 * shaders and buffers). This also handles general viewport management.
 *
 * If the view is not specified, a canvas will be created.
 * 
 * @class  WebGLContext
 * @constructor
 * @param {Number} width the width of the GL canvas
 * @param {Number} height the height of the GL canvas
 * @param {HTMLCanvasElement} view the optional DOM canvas element
 * @param {Object} contextAttribuets an object containing context attribs which
 *                                   will be used during GL initialization
 */
var WebGLContext = new Class({
	
	initialize: function WebGLContext(width, height, view, contextAttributes) {
		/**
		 * The list of rendering objects (shaders, VBOs, textures, etc) which are 
		 * currently being managed. Any object with a "create" method can be added
		 * to this list. Upon destroying the rendering object, it should be removed.
		 * See addManagedObject and removeManagedObject.
		 * 
		 * @property {Array} managedObjects
		 */
		this.managedObjects = [];

		/**
		 * The actual GL context. You can use this for
		 * raw GL calls or to access GLenum constants. This
		 * will be updated on context restore. While the WebGLContext
		 * is not `valid`, you should not try to access GL state.
		 * 
		 * @property gl
		 * @type {WebGLRenderingContext}
		 */
		this.gl = null;

		/**
		 * The canvas DOM element for this context.
		 * @property {Number} view
		 */
		this.view = view || document.createElement("canvas");

		//default size as per spec:
		//http://www.w3.org/TR/2012/WD-html5-author-20120329/the-canvas-element.html#the-canvas-element
		
		/**
		 * The width of this canvas.
		 *
		 * @property width
		 * @type {Number}
		 */
		this.width = this.view.width = width || 300;

		/**
		 * The height of this canvas.
		 * @property height
		 * @type {Number}
		 */
		this.height = this.view.height = height || 150;


		/**
		 * The context attributes for initializing the GL state. This might include
		 * anti-aliasing, alpha settings, verison, and so forth.
		 * 
		 * @property {Object} contextAttributes 
		 */
		this.contextAttributes = contextAttributes;
		
		/**
		 * Whether this context is 'valid', i.e. renderable. A context that has been lost
		 * (and not yet restored) or destroyed is invalid.
		 * 
		 * @property {Boolean} valid
		 */
		this.valid = false;

		/**
		 * A signal dispatched when GL context is lost. 
		 * 
		 * The first argument passed to the listener is the WebGLContext
		 * managing the context loss.
		 * 
		 * @event {Signal} lost
		 */
		this.lost = new Signal();

		/**
		 * A signal dispatched when GL context is restored, after all the managed
		 * objects have been recreated.
		 *
		 * The first argument passed to the listener is the WebGLContext
		 * which managed the restoration.
		 *
		 * This does not gaurentee that all objects will be renderable.
		 * For example, a Texture with an ImageProvider may still be loading
		 * asynchronously.	 
		 * 
		 * @event {Signal} restored
		 */
		this.restored = new Signal();	
		
		//setup context lost and restore listeners
		this.view.addEventListener("webglcontextlost", function (ev) {
			ev.preventDefault();
			this._contextLost(ev);
		}.bind(this));
		this.view.addEventListener("webglcontextrestored", function (ev) {
			ev.preventDefault();
			this._contextRestored(ev);
		}.bind(this));
			
		this._initContext();

		this.resize(this.width, this.height);
	},
	
	_initContext: function() {
		var err = "";
		this.valid = false;

		try {
			this.gl = (this.view.getContext('webgl', this.contextAttributes) 
						|| this.view.getContext('experimental-webgl', this.contextAttributes));
		} catch (e) {
			this.gl = null;
		}

		if (this.gl) {
			this.valid = true;
		} else {
			throw "WebGL Context Not Supported -- try enabling it or using a different browser";
		}	
	},

	/**
	 * Updates the width and height of this WebGL context, resizes
	 * the canvas view, and calls gl.viewport() with the new size.
	 * 
	 * @param  {Number} width  the new width
	 * @param  {Number} height the new height
	 */
	resize: function(width, height) {
		this.width = width;
		this.height = height;

		this.view.width = width;
		this.view.height = height;

		var gl = this.gl;
		gl.viewport(0, 0, this.width, this.height);
	},

	/**
	 * (internal use)
	 * A managed object is anything with a "create" function, that will
	 * restore GL state after context loss. 
	 * 
	 * @param {[type]} tex [description]
	 */
	addManagedObject: function(obj) {
		this.managedObjects.push(obj);
	},

	/**
	 * (internal use)
	 * Removes a managed object from the cache. This is useful to destroy
	 * a texture or shader, and have it no longer re-load on context restore.
	 *
	 * Returns the object that was removed, or null if it was not found in the cache.
	 * 
	 * @param  {Object} obj the object to be managed
	 * @return {Object}     the removed object, or null
	 */
	removeManagedObject: function(obj) {
		var idx = this.managedObjects.indexOf(obj);
		if (idx > -1) {
			this.managedObjects.splice(idx, 1);
			return obj;
		} 
		return null;
	},

	/**
	 * Calls destroy() on each managed object, then removes references to these objects
	 * and the GL rendering context. This also removes references to the view and sets
	 * the context's width and height to zero.
	 *
	 * Attempting to use this WebGLContext or the GL rendering context after destroying it
	 * will lead to undefined behaviour.
	 */
	destroy: function() {
		for (var i=0; i<this.managedObjects.length; i++) {
			var obj = this.managedObjects[i];
			if (obj && typeof obj.destroy === "function")
				obj.destroy();
		}
		this.managedObjects.length = 0;
		this.valid = false;
		this.gl = null;
		this.view = null;
		this.width = this.height = 0;
	},

	_contextLost: function(ev) {
		//all textures/shaders/buffers/FBOs have been deleted... 
		//we need to re-create them on restore
		this.valid = false;

		this.lost.dispatch(this);
	},

	_contextRestored: function(ev) {
		//first, initialize the GL context again
		this._initContext();

		//now we recreate our shaders and textures
		for (var i=0; i<this.managedObjects.length; i++) {
			this.managedObjects[i].create();
		}

		//update GL viewport
		this.resize(this.width, this.height);

		this.restored.dispatch(this);
	}
});

module.exports = WebGLContext;
},{"klasse":23,"signals":22}],17:[function(require,module,exports){
var Class = require('klasse');
var Texture = require('../Texture');


var FrameBuffer = new Class({

	/**
	 * Creates a new Frame Buffer Object with the given width and height.
	 *
	 * If width and height are non-numbers, this method expects the
	 * first parameter to be a Texture object which should be acted upon. 
	 * In this case, the FrameBuffer does not "own" the texture, and so it
	 * won't dispose of it upon destruction. This is an advanced version of the
	 * constructor that assumes the user is giving us a valid Texture that can be bound (i.e.
	 * no async Image textures).
	 *
	 * @class  FrameBuffer
	 * @constructor
	 * @param  {[type]} width  [description]
	 * @param  {[type]} height [description]
	 * @param  {[type]} filter [description]
	 * @return {[type]}        [description]
	 */
	initialize: function FrameBuffer(context, width, height, format) { //TODO: depth component
		if (typeof context !== "object")
			throw "GL context not specified to FrameBuffer";
	

		/**
		 * The underlying ID of the GL frame buffer object.
		 *
		 * @property {WebGLFramebuffer} id
		 */		
		this.id = null;

		/**
		 * The WebGLContext backed by this frame buffer.
		 *
		 * @property {WebGLContext} context
		 */
		this.context = context;

		/**
		 * The Texture backed by this frame buffer.
		 *
		 * @property {Texture} Texture
		 */
		//this Texture is now managed.
		this.texture = new Texture(context, width, height, format);

		//This is maanged by WebGLContext
		this.context.addManagedObject(this);
		this.create();
	},

	/**
	 * A read-only property which returns the width of the backing texture. 
	 * 
	 * @readOnly
	 * @property width
	 * @type {Number}
	 */
	width: {
		get: function() {
			return this.texture.width
		}
	},

	/**
	 * A read-only property which returns the height of the backing texture. 
	 * 
	 * @readOnly
	 * @property height
	 * @type {Number}
	 */
	height: {
		get: function() {
			return this.texture.height;
		}
	},


	/**
	 * Called during initialization to setup the frame buffer; also called on
	 * context restore. Users will not need to call this directly.
	 * 
	 * @method create
	 */
	create: function() {
		this.gl = this.context.gl; 
		var gl = this.gl;

		var tex = this.texture;

		//we assume the texture has already had create() called on it
		//since it was added as a managed object prior to this FrameBuffer
		tex.bind();
 
		this.id = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.id);

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex.target, tex.id, 0);

		var result = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (result != gl.FRAMEBUFFER_COMPLETE) {
			this.destroy(); //destroy our resources before leaving this function..

			var err = "Framebuffer not complete";
			switch (result) {
				case gl.FRAMEBUFFER_UNSUPPORTED:
					throw new Error(err + ": unsupported");
				case gl.INCOMPLETE_DIMENSIONS:
					throw new Error(err + ": incomplete dimensions");
				case gl.INCOMPLETE_ATTACHMENT:
					throw new Error(err + ": incomplete attachment");
				case gl.INCOMPLETE_MISSING_ATTACHMENT:
					throw new Error(err + ": missing attachment");
				default:
					throw new Error(err);
			}
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	},


	/**
	 * Destroys this frame buffer. Using this object after destroying it will have
	 * undefined results. 
	 * @method destroy
	 */
	destroy: function() {
		var gl = this.gl;

		if (this.texture)
			this.texture.destroy();
		if (this.id && this.gl)
			this.gl.deleteFramebuffer(this.id);
		if (this.context)
			this.context.removeManagedObject(this);

		this.id = null;
		this.gl = null;
		this.texture = null;
		this.context = null;
	},

	/**
	 * Binds this framebuffer and sets the viewport to the expected size.
	 * @method begin
	 */
	begin: function() {
		var gl = this.gl;
		gl.viewport(0, 0, this.texture.width, this.texture.height);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.id);
	},

	/**
	 * Binds the default frame buffer (the screen) and sets the viewport back
	 * to the size of the WebGLContext.
	 * 
	 * @method end
	 */
	end: function() {
		var gl = this.gl;
		gl.viewport(0, 0, this.context.width, this.context.height);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
});

module.exports = FrameBuffer;
},{"../Texture":14,"klasse":23}],18:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');

//TODO: decouple into VBO + IBO utilities 
/**
 * A mesh class that wraps VBO and IBO.
 *
 * @class  Mesh
 */
var Mesh = new Class({


	/**
	 * A write-only property which sets both vertices and indices 
	 * flag to dirty or not. 
	 *
	 * @property dirty
	 * @type {Boolean}
	 * @writeOnly
	 */
	dirty: {
		set: function(val) {
			this.verticesDirty = val;
			this.indicesDirty = val;
		}
	},

	/**
	 * Creates a new Mesh with the provided parameters.
	 *
	 * If numIndices is 0 or falsy, no index buffer will be used
	 * and indices will be an empty ArrayBuffer and a null indexBuffer.
	 * 
	 * If isStatic is true, then vertexUsage and indexUsage will
	 * be set to gl.STATIC_DRAW. Otherwise they will use gl.DYNAMIC_DRAW.
	 * You may want to adjust these after initialization for further control.
	 * 
	 * @param  {WebGLContext}  context the context for management
	 * @param  {Boolean} isStatic      a hint as to whether this geometry is static
	 * @param  {[type]}  numVerts      [description]
	 * @param  {[type]}  numIndices    [description]
	 * @param  {[type]}  vertexAttribs [description]
	 * @return {[type]}                [description]
	 */
	initialize: function Mesh(context, isStatic, numVerts, numIndices, vertexAttribs) {
		if (typeof context !== "object")
			throw "GL context not specified to Mesh";
		if (!numVerts)
			throw "numVerts not specified, must be > 0";

		this.context = context;
		this.gl = context.gl;
		
		this.numVerts = null;
		this.numIndices = null;
		
		this.vertices = null;
		this.indices = null;
		this.vertexBuffer = null;
		this.indexBuffer = null;

		this.verticesDirty = true;
		this.indicesDirty = true;
		this.indexUsage = null;
		this.vertexUsage = null;

		/** 
		 * @property
		 * @private
		 */
		this._vertexAttribs = null;

		/** 
		 * The stride for one vertex _in bytes_. 
		 * 
		 * @property {Number} vertexStride
		 */
		this.vertexStride = null;

		this.numVerts = numVerts;
		this.numIndices = numIndices || 0;
		this.vertexUsage = isStatic ? this.gl.STATIC_DRAW : this.gl.DYNAMIC_DRAW;
		this.indexUsage  = isStatic ? this.gl.STATIC_DRAW : this.gl.DYNAMIC_DRAW;
		this._vertexAttribs = vertexAttribs || [];
		
		this.indicesDirty = true;
		this.verticesDirty = true;

		//determine the vertex stride based on given attributes
		var totalNumComponents = 0;
		for (var i=0; i<this._vertexAttribs.length; i++)
			totalNumComponents += this._vertexAttribs[i].offsetCount;
		this.vertexStride = totalNumComponents * 4; // in bytes

		this.vertices = new Float32Array(this.numVerts);
		this.indices = new Uint16Array(this.numIndices);

		//add this VBO to the managed cache
		this.context.addManagedObject(this);

		this.create();
	},

	//recreates the buffers on context loss
	create: function() {
		this.gl = this.context.gl;
		var gl = this.gl;
		this.vertexBuffer = gl.createBuffer();

		//ignore index buffer if we haven't specified any
		this.indexBuffer = this.numIndices > 0
					? gl.createBuffer()
					: null;

		this.dirty = true;
	},

	destroy: function() {
		this.vertices = null;
		this.indices = null;
		if (this.vertexBuffer && this.gl)
			this.gl.deleteBuffer(this.vertexBuffer);
		if (this.indexBuffer && this.gl)
			this.gl.deleteBuffer(this.indexBuffer);
		this.vertexBuffer = null;
		this.indexBuffer = null;
		if (this.context)
			this.context.removeManagedObject(this);
		this.gl = null;
		this.context = null;
	},

	_updateBuffers: function(ignoreBind, subDataLength) {
		var gl = this.gl;

		//bind our index data, if we have any
		if (this.numIndices > 0) {
			if (!ignoreBind)
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

			//update the index data
			if (this.indicesDirty) {
				gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, this.indexUsage);
				this.indicesDirty = false;
			}
		}

		//bind our vertex data
		if (!ignoreBind)
			gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

		//update our vertex data
		if (this.verticesDirty) {
			if (subDataLength) {
				// TODO: When decoupling VBO/IBO be sure to give better subData support..
				var view = this.vertices.subarray(0, subDataLength);
				gl.bufferSubData(gl.ARRAY_BUFFER, 0, view);
			} else {
				gl.bufferData(gl.ARRAY_BUFFER, this.vertices, this.vertexUsage);	
			}

			
			this.verticesDirty = false;
		}
	},

	draw: function(primitiveType, count, offset, subDataLength) {
		if (count === 0)
			return;

		var gl = this.gl;
		
		offset = offset || 0;

		//binds and updates our buffers. pass ignoreBind as true
		//to avoid binding unnecessarily
		this._updateBuffers(true, subDataLength);

		if (this.numIndices > 0) { 
			gl.drawElements(primitiveType, count, 
						gl.UNSIGNED_SHORT, offset * 2); //* Uint16Array.BYTES_PER_ELEMENT
		} else
			gl.drawArrays(primitiveType, offset, count);
	},

	//binds this mesh's vertex attributes for the given shader
	bind: function(shader) {
		var gl = this.gl;

		var offset = 0;
		var stride = this.vertexStride;

		//bind and update our vertex data before binding attributes
		this._updateBuffers();

		//for each attribtue
		for (var i=0; i<this._vertexAttribs.length; i++) {
			var a = this._vertexAttribs[i];

		    var aloc = a.location1; 
			//location1 of the attribute
			var loc = aloc === null 
					? shader.getAttributeLocation(a.name)
					: a.location1;

			//TODO: We may want to skip unfound attribs
			// if (loc!==0 && !loc)
			// 	console.warn("WARN:", a.name, "is not enabled");

			//first, enable the vertex array
			gl.enableVertexAttribArray(loc);

			//then specify our vertex format
			gl.vertexAttribPointer(loc, a.numComponents, a.type || gl.FLOAT, 
								   a.normalize, stride, offset);

			//and increase the offset...
			offset += a.offsetCount * 4; //in bytes
		}
	},

	unbind: function(shader) {
		var gl = this.gl;

		//for each attribtue
		for (var i=0; i<this._vertexAttribs.length; i++) {
			var a = this._vertexAttribs[i];

			var aloc = a.location1;

			//location1 of the attribute
			var loc = aloc === null 
					? shader.getAttributeLocation(a.name)
					: a.location1;

			//first, enable the vertex array
			gl.disableVertexAttribArray(loc);
		}
	}
});

Mesh.Attrib = new Class({

	name: null,
	numComponents: null,
	location1: null,
	type: null,

	/**
	 * Location is optional and for advanced users that
	 * want vertex arrays to match across shaders. Any non-numerical
	 * value will be converted to null, and ignored. If a numerical
	 * value is given, it will override the position of this attribute
	 * when given to a mesh.
	 * 
	 * @param  {[type]} name          [description]
	 * @param  {[type]} numComponents [description]
	 * @param  {[type]} location1      [description]
	 * @return {[type]}               [description]
	 */
	initialize: function(name, numComponents, location1, type, normalize, offsetCount) {
		this.name = name;
		this.numComponents = numComponents;
		this.location1 = typeof location1 === "number" ? location1 : null;
		this.type = type;
		this.normalize = Boolean(normalize);
		this.offsetCount = typeof offsetCount === "number" ? offsetCount : this.numComponents;
	}
})


module.exports = Mesh;
},{"klasse":23}],19:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');


var ShaderProgram = new Class({
	
	/**
	 * Creates a new ShaderProgram from the given source, and an optional map of attribute
	 * location1s as <name, index> pairs.
	 *
	 * _Note:_ Chrome version 31 was giving me issues with attribute location1s -- you may
	 * want to omit this to let the browser pick the location1s for you.	
	 *
	 * @class  ShaderProgram
	 * @constructor
	 * @param  {WebGLContext} context      the context to manage this object
	 * @param  {String} vertSource         the vertex shader source
	 * @param  {String} fragSource         the fragment shader source
	 * @param  {Object} attributeLocations the attribute location1s
	 */
	initialize: function ShaderProgram(context, vertSource, fragSource, attributeLocations) {
		if (!vertSource || !fragSource)
			throw "vertex and fragment shaders must be defined";
		if (typeof context !== "object")
			throw "GL context not specified to ShaderProgram";
		this.context = context;

		this.vertShader = null;
		this.fragShader = null;
		this.program = null;
		this.log = "";

		this.uniformCache = null;
		this.attributeCache = null;

		this.attributeLocations = attributeLocations;

		//We trim (ECMAScript5) so that the GLSL line numbers are
		//accurate on shader log
		this.vertSource = vertSource.trim();
		this.fragSource = fragSource.trim();

		//Adds this shader to the context, to be managed
		this.context.addManagedObject(this);

		this.create();
	},

	/** 
	 * This is called during the ShaderProgram constructor,
	 * and may need to be called again after context loss and restore.
	 * 
	 * @method  create
	 */
	create: function() {
		this.gl = this.context.gl;
		this._compileShaders();
	},

	//Compiles the shaders, throwing an error if the program was invalid.
	_compileShaders: function() {
		var gl = this.gl; 
		
		this.log = "";

		this.vertShader = this._loadShader(gl.VERTEX_SHADER, this.vertSource);
		this.fragShader = this._loadShader(gl.FRAGMENT_SHADER, this.fragSource);

		if (!this.vertShader || !this.fragShader)
			throw "Error returned when calling createShader";

		this.program = gl.createProgram();

		gl.attachShader(this.program, this.vertShader);
		gl.attachShader(this.program, this.fragShader);
	
		//TODO: This seems not to be working on my OSX -- maybe a driver bug?
		if (this.attributeLocations) {
			for (var key in this.attributeLocations) {
				if (this.attributeLocations.hasOwnProperty(key)) {
					gl.bindAttribLocation(this.program, Math.floor(this.attributeLocations[key]), key);
				}
			}
		}

		gl.linkProgram(this.program); 

		this.log += gl.getProgramInfoLog(this.program) || "";

		if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
			throw "Error linking the shader program:\n"
				+ this.log;
		}

		this._fetchUniforms();
		this._fetchAttributes();
	},

	_fetchUniforms: function() {
		var gl = this.gl;

		this.uniformCache = {};

		var len = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
		if (!len) //null or zero
			return;

		for (var i=0; i<len; i++) {
			var info = gl.getActiveUniform(this.program, i);
			if (info === null) 
				continue;
			var name = info.name;
			var location1 = gl.getUniformLocation(this.program, name);
			
			this.uniformCache[name] = {
				size: info.size,
				type: info.type,
				location1: location1
			};
		}
	},

	_fetchAttributes: function() { 
		var gl = this.gl; 

		this.attributeCache = {};

		var len = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
		if (!len) //null or zero
			return;	

		for (var i=0; i<len; i++) {
			var info = gl.getActiveAttrib(this.program, i);
			if (info === null) 
				continue;
			var name = info.name;

			//the attrib location1 is a simple index
			var location1 = gl.getAttribLocation(this.program, name);
			
			this.attributeCache[name] = {
				size: info.size,
				type: info.type,
				location1: location1
			};
		}
	},

	_loadShader: function(type, source) {
		var gl = this.gl;

		var shader = gl.createShader(type);
		if (!shader) //should not occur...
			return -1;

		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		
		var logResult = gl.getShaderInfoLog(shader) || "";
		if (logResult) {
			//we do this so the user knows which shader has the error
			var typeStr = (type === gl.VERTEX_SHADER) ? "vertex" : "fragment";
			logResult = "Error compiling "+ typeStr+ " shader:\n"+logResult;
		}

		this.log += logResult;

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) ) {
			throw this.log;
		}
		return shader;
	},

	/**
	 * Called to bind this shader. Note that there is no "unbind" since
	 * technically such a thing is not possible in the programmable pipeline.
	 *
	 * You must bind a shader before settings its uniforms.
	 * 
	 * @method bind
	 */
	bind: function() {
		this.gl.useProgram(this.program);
	},


	/**
	 * Destroys this shader and its resources. You should not try to use this
	 * after destroying it.
	 * @method  destroy
	 */
	destroy: function() {
		if (this.context)
			this.context.removeManagedObject(this);

		if (this.gl) {
			var gl = this.gl;
			gl.detachShader(this.vertShader);
			gl.detachShader(this.fragShader);

			gl.deleteShader(this.vertShader);
			gl.deleteShader(this.fragShader);
			gl.deleteProgram(this.program);
		}
		this.attributeCache = null;
		this.uniformCache = null;
		this.vertShader = null;
		this.fragShader = null;
		this.program = null;
		this.gl = null;
		this.context = null;
	},


	/**
	 * Returns the cached uniform info (size, type, location1).
	 * If the uniform is not found in the cache, it is assumed
	 * to not exist, and this method returns null.
	 *
	 * This may return null even if the uniform is defined in GLSL:
	 * if it is _inactive_ (i.e. not used in the program) then it may
	 * be optimized out.
	 *
	 * @method  getUniformInfo
	 * @param  {String} name the uniform name as defined in GLSL
	 * @return {Object} an object containing location1, size, and type
	 */
	getUniformInfo: function(name) {
		return this.uniformCache[name] || null; 
	},

	/**
	 * Returns the cached attribute info (size, type, location1).
	 * If the attribute is not found in the cache, it is assumed
	 * to not exist, and this method returns null.
	 *
	 * This may return null even if the attribute is defined in GLSL:
	 * if it is _inactive_ (i.e. not used in the program or disabled) 
	 * then it may be optimized out.
	 *
	 * @method  getAttributeInfo
	 * @param  {String} name the attribute name as defined in GLSL
	 * @return {object} an object containing location1, size and type
	 */
	getAttributeInfo: function(name) {
		return this.attributeCache[name] || null; 
	},


	/**
	 * Returns the cached uniform location1 object.
	 * If the uniform is not found, this method returns null.
	 *
	 * @method  getAttributeLocation
	 * @param  {String} name the uniform name as defined in GLSL
	 * @return {GLint} the location1 object
	 */
	getAttributeLocation: function(name) { //TODO: make faster, don't cache
		var info = this.getAttributeInfo(name);
		return info ? info.location1 : null;
	},

	/**
	 * Returns the cached uniform location1 object, assuming it exists
	 * and is active. Note that uniforms may be inactive if 
	 * the GLSL compiler deemed them unused.
	 *
	 * @method  getUniformLocation
	 * @param  {String} name the uniform name as defined in GLSL
	 * @return {WebGLUniformLocation} the location1 object
	 */
	getUniformLocation: function(name) {
		var info = this.getUniformInfo(name);
		return info ? info.location1 : null;
	},

	/**
	 * Returns true if the uniform is active and found in this
	 * compiled program. Note that uniforms may be inactive if 
	 * the GLSL compiler deemed them unused.
	 *
	 * @method  hasUniform
	 * @param  {String}  name the uniform name
	 * @return {Boolean} true if the uniform is found and active
	 */
	hasUniform: function(name) {
		return this.getUniformInfo(name) !== null;
	},

	/**
	 * Returns true if the attribute is active and found in this
	 * compiled program.
	 *
	 * @method  hasAttribute
	 * @param  {String}  name the attribute name
	 * @return {Boolean} true if the attribute is found and active
	 */
	hasAttribute: function(name) {
		return this.getAttributeInfo(name) !== null;
	},

	/**
	 * Returns the uniform value by name.
	 *
	 * @method  getUniform
	 * @param  {String} name the uniform name as defined in GLSL
	 * @return {any} The value of the WebGL uniform
	 */
	getUniform: function(name) {
		return this.gl.getUniform(this.program, this.getUniformLocation(name));
	},

	/**
	 * Returns the uniform value at the specified WebGLUniformLocation.
	 *
	 * @method  getUniformAt
	 * @param  {WebGLUniformLocation} location1 the location1 object
	 * @return {any} The value of the WebGL uniform
	 */
	getUniformAt: function(location1) {
		return this.gl.getUniform(this.program, location1);
	},

	/**
	 * A convenience method to set uniformi from the given arguments.
	 * We determine which GL call to make based on the number of arguments
	 * passed. For example, `setUniformi("var", 0, 1)` maps to `gl.uniform2i`.
	 * 
	 * @method  setUniformi
	 * @param {String} name        		the name of the uniform
	 * @param {GLint} x  the x component for ints
	 * @param {GLint} y  the y component for ivec2
	 * @param {GLint} z  the z component for ivec3
	 * @param {GLint} w  the w component for ivec4
	 */
	setUniformi: function(name, x, y, z, w) {
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
			return false;
		switch (arguments.length) {
			case 2: gl.uniform1i(loc, x); return true;
			case 3: gl.uniform2i(loc, x, y); return true;
			case 4: gl.uniform3i(loc, x, y, z); return true;
			case 5: gl.uniform4i(loc, x, y, z, w); return true;
			default:
				throw "invalid arguments to setUniformi"; 
		}
	},

	/**
	 * A convenience method to set uniformf from the given arguments.
	 * We determine which GL call to make based on the number of arguments
	 * passed. For example, `setUniformf("var", 0, 1)` maps to `gl.uniform2f`.
	 * 
	 * @method  setUniformf
	 * @param {String} name        		the name of the uniform
	 * @param {GLfloat} x  the x component for floats
	 * @param {GLfloat} y  the y component for vec2
	 * @param {GLfloat} z  the z component for vec3
	 * @param {GLfloat} w  the w component for vec4
	 */
	setUniformf: function(name, x, y, z, w) {
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
			return false;
		switch (arguments.length) {
			case 2: gl.uniform1f(loc, x); return true;
			case 3: gl.uniform2f(loc, x, y); return true;
			case 4: gl.uniform3f(loc, x, y, z); return true;
			case 5: gl.uniform4f(loc, x, y, z, w); return true;
			default:
				throw "invalid arguments to setUniformf"; 
		}
	},

	//I guess we won't support sequence<GLfloat> .. whatever that is ??
	

	///// 
	
	/**
	 * A convenience method to set uniformNfv from the given ArrayBuffer.
	 * We determine which GL call to make based on the length of the array 
	 * buffer (for 1-4 component vectors stored in a Float32Array). To use
	 * this method to upload data to uniform arrays, you need to specify the
	 * 'count' parameter; i.e. the data type you are using for that array. If
	 * specified, this will dictate whether to call uniform1fv, uniform2fv, etc.
	 *
	 * @method  setUniformfv
	 * @param {String} name        		the name of the uniform
	 * @param {ArrayBuffer} arrayBuffer the array buffer
	 * @param {Number} count            optional, the explicit data type count, e.g. 2 for vec2
	 */
	setUniformfv: function(name, arrayBuffer, count) {
		count = count || arrayBuffer.length;
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
			return false;
		switch (count) {
			case 1: gl.uniform1fv(loc, arrayBuffer); return true;
			case 2: gl.uniform2fv(loc, arrayBuffer); return true;
			case 3: gl.uniform3fv(loc, arrayBuffer); return true;
			case 4: gl.uniform4fv(loc, arrayBuffer); return true;
			default:
				throw "invalid arguments to setUniformf"; 
		}
	},

	/**
	 * A convenience method to set uniformNiv from the given ArrayBuffer.
	 * We determine which GL call to make based on the length of the array 
	 * buffer (for 1-4 component vectors stored in a int array). To use
	 * this method to upload data to uniform arrays, you need to specify the
	 * 'count' parameter; i.e. the data type you are using for that array. If
	 * specified, this will dictate whether to call uniform1fv, uniform2fv, etc.
	 *
	 * @method  setUniformiv
	 * @param {String} name        		the name of the uniform
	 * @param {ArrayBuffer} arrayBuffer the array buffer
	 * @param {Number} count            optional, the explicit data type count, e.g. 2 for ivec2
	 */
	setUniformiv: function(name, arrayBuffer, count) {
		count = count || arrayBuffer.length;
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
			return false;
		switch (count) {
			case 1: gl.uniform1iv(loc, arrayBuffer); return true;
			case 2: gl.uniform2iv(loc, arrayBuffer); return true;
			case 3: gl.uniform3iv(loc, arrayBuffer); return true;
			case 4: gl.uniform4iv(loc, arrayBuffer); return true;
			default:
				throw "invalid arguments to setUniformf"; 
		}
	},

	/**
	 * This is a convenience function to pass a Matrix3 (from vecmath,
	 * kami's preferred math library) or a Float32Array (e.g. gl-matrix)
	 * to a shader. If mat is an object with "val", it is considered to be
	 * a Matrix3, otherwise assumed to be a typed array being passed directly
	 * to the shader.
	 * 
	 * @param {String} name the uniform name
	 * @param {Matrix3|Float32Array} mat a Matrix3 or Float32Array
	 * @param {Boolean} transpose whether to transpose the matrix, default false
	 */
	setUniformMatrix3: function(name, mat, transpose) {
		var arr = typeof mat === "object" && mat.val ? mat.val : mat;
		transpose = !!transpose; //to boolean

		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
			return false;
		gl.uniformMatrix3fv(loc, transpose, arr)
	},

	/**
	 * This is a convenience function to pass a Matrix4 (from vecmath,
	 * kami's preferred math library) or a Float32Array (e.g. gl-matrix)
	 * to a shader. If mat is an object with "val", it is considered to be
	 * a Matrix4, otherwise assumed to be a typed array being passed directly
	 * to the shader.
	 * 
	 * @param {String} name the uniform name
	 * @param {Matrix4|Float32Array} mat a Matrix4 or Float32Array
	 * @param {Boolean} transpose whether to transpose the matrix, default false
	 */
	setUniformMatrix4: function(name, mat, transpose) {
		var arr = typeof mat === "object" && mat.val ? mat.val : mat;
		transpose = !!transpose; //to boolean

		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
			return false;
		gl.uniformMatrix4fv(loc, transpose, arr)
	} 
 
});

//Some default attribute names that parts of kami will use
//when creating a standard shader.
ShaderProgram.POSITION_ATTRIBUTE = "Position";
ShaderProgram.NORMAL_ATTRIBUTE = "Normal";
ShaderProgram.COLOR_ATTRIBUTE = "Color";
ShaderProgram.TEXCOORD_ATTRIBUTE = "TexCoord";

module.exports = ShaderProgram;
},{"klasse":23}],20:[function(require,module,exports){
/**
  Auto-generated Kami index file.
  Created on 2014-03-02.
*/
module.exports = {
    //core classes
    'BaseBatch':       require('./BaseBatch.js'),
    'SpriteBatch':     require('./SpriteBatch.js'),
    'Texture':         require('./Texture.js'),
    'TextureRegion':   require('./TextureRegion.js'),
    'WebGLContext':    require('./WebGLContext.js'),
    'FrameBuffer':     require('./glutils/FrameBuffer.js'),
    'Mesh':            require('./glutils/Mesh.js'),
    'ShaderProgram':   require('./glutils/ShaderProgram.js')
};
},{"./BaseBatch.js":12,"./SpriteBatch.js":13,"./Texture.js":14,"./TextureRegion.js":15,"./WebGLContext.js":16,"./glutils/FrameBuffer.js":17,"./glutils/Mesh.js":18,"./glutils/ShaderProgram.js":19}],21:[function(require,module,exports){
module.exports=require(11)
},{}],22:[function(require,module,exports){
/*jslint onevar:true, undef:true, newcap:true, regexp:true, bitwise:true, maxerr:50, indent:4, white:false, nomen:false, plusplus:false */
/*global define:false, require:false, exports:false, module:false, signals:false */

/** @license
 * JS Signals <http://millermedeiros.github.com/js-signals/>
 * Released under the MIT license
 * Author: Miller Medeiros
 * Version: 1.0.0 - Build: 268 (2012/11/29 05:48 PM)
 */

(function(global){

    // SignalBinding -------------------------------------------------
    //================================================================

    /**
     * Object that represents a binding between a Signal and a listener function.
     * <br />- <strong>This is an internal constructor and shouldn't be called by regular users.</strong>
     * <br />- inspired by Joa Ebert AS3 SignalBinding and Robert Penner's Slot classes.
     * @author Miller Medeiros
     * @constructor
     * @internal
     * @name SignalBinding
     * @param {Signal} signal Reference to Signal object that listener is currently bound to.
     * @param {Function} listener Handler function bound to the signal.
     * @param {boolean} isOnce If binding should be executed just once.
     * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
     * @param {Number} [priority] The priority level of the event listener. (default = 0).
     */
    function SignalBinding(signal, listener, isOnce, listenerContext, priority) {

        /**
         * Handler function bound to the signal.
         * @type Function
         * @private
         */
        this._listener = listener;

        /**
         * If binding should be executed just once.
         * @type boolean
         * @private
         */
        this._isOnce = isOnce;

        /**
         * Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @memberOf SignalBinding.prototype
         * @name context
         * @type Object|undefined|null
         */
        this.context = listenerContext;

        /**
         * Reference to Signal object that listener is currently bound to.
         * @type Signal
         * @private
         */
        this._signal = signal;

        /**
         * Listener priority
         * @type Number
         * @private
         */
        this._priority = priority || 0;
    }

    SignalBinding.prototype = {

        /**
         * If binding is active and should be executed.
         * @type boolean
         */
        active : true,

        /**
         * Default parameters passed to listener during `Signal.dispatch` and `SignalBinding.execute`. (curried parameters)
         * @type Array|null
         */
        params : null,

        /**
         * Call listener passing arbitrary parameters.
         * <p>If binding was added using `Signal.addOnce()` it will be automatically removed from signal dispatch queue, this method is used internally for the signal dispatch.</p>
         * @param {Array} [paramsArr] Array of parameters that should be passed to the listener
         * @return {*} Value returned by the listener.
         */
        execute : function (paramsArr) {
            var handlerReturn, params;
            if (this.active && !!this._listener) {
                params = this.params? this.params.concat(paramsArr) : paramsArr;
                handlerReturn = this._listener.apply(this.context, params);
                if (this._isOnce) {
                    this.detach();
                }
            }
            return handlerReturn;
        },

        /**
         * Detach binding from signal.
         * - alias to: mySignal.remove(myBinding.getListener());
         * @return {Function|null} Handler function bound to the signal or `null` if binding was previously detached.
         */
        detach : function () {
            return this.isBound()? this._signal.remove(this._listener, this.context) : null;
        },

        /**
         * @return {Boolean} `true` if binding is still bound to the signal and have a listener.
         */
        isBound : function () {
            return (!!this._signal && !!this._listener);
        },

        /**
         * @return {boolean} If SignalBinding will only be executed once.
         */
        isOnce : function () {
            return this._isOnce;
        },

        /**
         * @return {Function} Handler function bound to the signal.
         */
        getListener : function () {
            return this._listener;
        },

        /**
         * @return {Signal} Signal that listener is currently bound to.
         */
        getSignal : function () {
            return this._signal;
        },

        /**
         * Delete instance properties
         * @private
         */
        _destroy : function () {
            delete this._signal;
            delete this._listener;
            delete this.context;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[SignalBinding isOnce:' + this._isOnce +', isBound:'+ this.isBound() +', active:' + this.active + ']';
        }

    };


/*global SignalBinding:false*/

    // Signal --------------------------------------------------------
    //================================================================

    function validateListener(listener, fnName) {
        if (typeof listener !== 'function') {
            throw new Error( 'listener is a required param of {fn}() and should be a Function.'.replace('{fn}', fnName) );
        }
    }

    /**
     * Custom event broadcaster
     * <br />- inspired by Robert Penner's AS3 Signals.
     * @name Signal
     * @author Miller Medeiros
     * @constructor
     */
    function Signal() {
        /**
         * @type Array.<SignalBinding>
         * @private
         */
        this._bindings = [];
        this._prevParams = null;

        // enforce dispatch to aways work on same context (#47)
        var self = this;
        this.dispatch = function(){
            Signal.prototype.dispatch.apply(self, arguments);
        };
    }

    Signal.prototype = {

        /**
         * Signals Version Number
         * @type String
         * @const
         */
        VERSION : '1.0.0',

        /**
         * If Signal should keep record of previously dispatched parameters and
         * automatically execute listener during `add()`/`addOnce()` if Signal was
         * already dispatched before.
         * @type boolean
         */
        memorize : false,

        /**
         * @type boolean
         * @private
         */
        _shouldPropagate : true,

        /**
         * If Signal is active and should broadcast events.
         * <p><strong>IMPORTANT:</strong> Setting this property during a dispatch will only affect the next dispatch, if you want to stop the propagation of a signal use `halt()` instead.</p>
         * @type boolean
         */
        active : true,

        /**
         * @param {Function} listener
         * @param {boolean} isOnce
         * @param {Object} [listenerContext]
         * @param {Number} [priority]
         * @return {SignalBinding}
         * @private
         */
        _registerListener : function (listener, isOnce, listenerContext, priority) {

            var prevIndex = this._indexOfListener(listener, listenerContext),
                binding;

            if (prevIndex !== -1) {
                binding = this._bindings[prevIndex];
                if (binding.isOnce() !== isOnce) {
                    throw new Error('You cannot add'+ (isOnce? '' : 'Once') +'() then add'+ (!isOnce? '' : 'Once') +'() the same listener without removing the relationship first.');
                }
            } else {
                binding = new SignalBinding(this, listener, isOnce, listenerContext, priority);
                this._addBinding(binding);
            }

            if(this.memorize && this._prevParams){
                binding.execute(this._prevParams);
            }

            return binding;
        },

        /**
         * @param {SignalBinding} binding
         * @private
         */
        _addBinding : function (binding) {
            //simplified insertion sort
            var n = this._bindings.length;
            do { --n; } while (this._bindings[n] && binding._priority <= this._bindings[n]._priority);
            this._bindings.splice(n + 1, 0, binding);
        },

        /**
         * @param {Function} listener
         * @return {number}
         * @private
         */
        _indexOfListener : function (listener, context) {
            var n = this._bindings.length,
                cur;
            while (n--) {
                cur = this._bindings[n];
                if (cur._listener === listener && cur.context === context) {
                    return n;
                }
            }
            return -1;
        },

        /**
         * Check if listener was attached to Signal.
         * @param {Function} listener
         * @param {Object} [context]
         * @return {boolean} if Signal has the specified listener.
         */
        has : function (listener, context) {
            return this._indexOfListener(listener, context) !== -1;
        },

        /**
         * Add a listener to the signal.
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        add : function (listener, listenerContext, priority) {
            validateListener(listener, 'add');
            return this._registerListener(listener, false, listenerContext, priority);
        },

        /**
         * Add listener to the signal that should be removed after first execution (will be executed only once).
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        addOnce : function (listener, listenerContext, priority) {
            validateListener(listener, 'addOnce');
            return this._registerListener(listener, true, listenerContext, priority);
        },

        /**
         * Remove a single listener from the dispatch queue.
         * @param {Function} listener Handler function that should be removed.
         * @param {Object} [context] Execution context (since you can add the same handler multiple times if executing in a different context).
         * @return {Function} Listener handler function.
         */
        remove : function (listener, context) {
            validateListener(listener, 'remove');

            var i = this._indexOfListener(listener, context);
            if (i !== -1) {
                this._bindings[i]._destroy(); //no reason to a SignalBinding exist if it isn't attached to a signal
                this._bindings.splice(i, 1);
            }
            return listener;
        },

        /**
         * Remove all listeners from the Signal.
         */
        removeAll : function () {
            var n = this._bindings.length;
            while (n--) {
                this._bindings[n]._destroy();
            }
            this._bindings.length = 0;
        },

        /**
         * @return {number} Number of listeners attached to the Signal.
         */
        getNumListeners : function () {
            return this._bindings.length;
        },

        /**
         * Stop propagation of the event, blocking the dispatch to next listeners on the queue.
         * <p><strong>IMPORTANT:</strong> should be called only during signal dispatch, calling it before/after dispatch won't affect signal broadcast.</p>
         * @see Signal.prototype.disable
         */
        halt : function () {
            this._shouldPropagate = false;
        },

        /**
         * Dispatch/Broadcast Signal to all listeners added to the queue.
         * @param {...*} [params] Parameters that should be passed to each handler.
         */
        dispatch : function (params) {
            if (! this.active) {
                return;
            }

            var paramsArr = Array.prototype.slice.call(arguments),
                n = this._bindings.length,
                bindings;

            if (this.memorize) {
                this._prevParams = paramsArr;
            }

            if (! n) {
                //should come after memorize
                return;
            }

            bindings = this._bindings.slice(); //clone array in case add/remove items during dispatch
            this._shouldPropagate = true; //in case `halt` was called before dispatch or during the previous dispatch.

            //execute all callbacks until end of the list or until a callback returns `false` or stops propagation
            //reverse loop since listeners with higher priority will be added at the end of the list
            do { n--; } while (bindings[n] && this._shouldPropagate && bindings[n].execute(paramsArr) !== false);
        },

        /**
         * Forget memorized arguments.
         * @see Signal.memorize
         */
        forget : function(){
            this._prevParams = null;
        },

        /**
         * Remove all bindings from signal and destroy any reference to external objects (destroy Signal object).
         * <p><strong>IMPORTANT:</strong> calling any method on the signal instance after calling dispose will throw errors.</p>
         */
        dispose : function () {
            this.removeAll();
            delete this._bindings;
            delete this._prevParams;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[Signal active:'+ this.active +' numListeners:'+ this.getNumListeners() +']';
        }

    };


    // Namespace -----------------------------------------------------
    //================================================================

    /**
     * Signals namespace
     * @namespace
     * @name signals
     */
    var signals = Signal;

    /**
     * Custom event broadcaster
     * @see Signal
     */
    // alias for backwards compatibility (see #gh-44)
    signals.Signal = Signal;



    //exports to multiple environments
    if(typeof define === 'function' && define.amd){ //AMD
        define(function () { return signals; });
    } else if (typeof module !== 'undefined' && module.exports){ //node
        module.exports = signals;
    } else { //browser
        //use string because of Google closure compiler ADVANCED_MODE
        /*jslint sub:true */
        global['signals'] = signals;
    }

}(this));

},{}],23:[function(require,module,exports){
function hasGetterOrSetter(def) {
	return (!!def.get && typeof def.get === "function") || (!!def.set && typeof def.set === "function");
}

function getProperty(definition, k, isClassDescriptor) {
	//This may be a lightweight object, OR it might be a property
	//that was defined previously.
	
	//For simple class descriptors we can just assume its NOT previously defined.
	var def = isClassDescriptor 
				? definition[k] 
				: Object.getOwnPropertyDescriptor(definition, k);

	if (!isClassDescriptor && def.value && typeof def.value === "object") {
		def = def.value;
	}


	//This might be a regular property, or it may be a getter/setter the user defined in a class.
	if ( def && hasGetterOrSetter(def) ) {
		if (typeof def.enumerable === "undefined")
			def.enumerable = true;
		if (typeof def.configurable === "undefined")
			def.configurable = true;
		return def;
	} else {
		return false;
	}
}

function hasNonConfigurable(obj, k) {
	var prop = Object.getOwnPropertyDescriptor(obj, k);
	if (!prop)
		return false;

	if (prop.value && typeof prop.value === "object")
		prop = prop.value;

	if (prop.configurable === false) 
		return true;

	return false;
}

//TODO: On create, 
//		On mixin, 

function extend(ctor, definition, isClassDescriptor, extend) {
	for (var k in definition) {
		if (!definition.hasOwnProperty(k))
			continue;

		var def = getProperty(definition, k, isClassDescriptor);

		if (def !== false) {
			//If Extends is used, we will check its prototype to see if 
			//the final variable exists.
			
			var parent = extend || ctor;
			if (hasNonConfigurable(parent.prototype, k)) {

				//just skip the final property
				if (Class.ignoreFinals)
					continue;

				//We cannot re-define a property that is configurable=false.
				//So we will consider them final and throw an error. This is by
				//default so it is clear to the developer what is happening.
				//You can set ignoreFinals to true if you need to extend a class
				//which has configurable=false; it will simply not re-define final properties.
				throw new Error("cannot override final property '"+k
							+"', set Class.ignoreFinals = true to skip");
			}

			Object.defineProperty(ctor.prototype, k, def);
		} else {
			ctor.prototype[k] = definition[k];
		}

	}
}

/**
 */
function mixin(myClass, mixins) {
	if (!mixins)
		return;

	if (!Array.isArray(mixins))
		mixins = [mixins];

	for (var i=0; i<mixins.length; i++) {
		extend(myClass, mixins[i].prototype || mixins[i]);
	}
}

/**
 * Creates a new class with the given descriptor.
 * The constructor, defined by the name `initialize`,
 * is an optional function. If unspecified, an anonymous
 * function will be used which calls the parent class (if
 * one exists). 
 *
 * You can also use `Extends` and `Mixins` to provide subclassing
 * and inheritance.
 *
 * @class  Class
 * @constructor
 * @param {Object} definition a dictionary of functions for the class
 * @example
 *
 * 		var MyClass = new Class({
 * 		
 * 			initialize: function() {
 * 				this.foo = 2.0;
 * 			},
 *
 * 			bar: function() {
 * 				return this.foo + 5;
 * 			}
 * 		});
 */
function Class(definition) {
	if (!definition)
		definition = {};

	//The variable name here dictates what we see in Chrome debugger
	var initialize;
	var Extends;

	if (definition.initialize) {
		if (typeof definition.initialize !== "function")
			throw new Error("initialize must be a function");
		initialize = definition.initialize;

		//Usually we should avoid "delete" in V8 at all costs.
		//However, its unlikely to make any performance difference
		//here since we only call this on class creation (i.e. not object creation).
		delete definition.initialize;
	} else {
		if (definition.Extends) {
			var base = definition.Extends;
			initialize = function () {
				base.apply(this, arguments);
			}; 
		} else {
			initialize = function () {}; 
		}
	}

	if (definition.Extends) {
		initialize.prototype = Object.create(definition.Extends.prototype);
		initialize.prototype.constructor = initialize;
		//for getOwnPropertyDescriptor to work, we need to act
		//directly on the Extends (or Mixin)
		Extends = definition.Extends;
		delete definition.Extends;
	} else {
		initialize.prototype.constructor = initialize;
	}

	//Grab the mixins, if they are specified...
	var mixins = null;
	if (definition.Mixins) {
		mixins = definition.Mixins;
		delete definition.Mixins;
	}

	//First, mixin if we can.
	mixin(initialize, mixins);

	//Now we grab the actual definition which defines the overrides.
	extend(initialize, definition, true, Extends);

	return initialize;
};

Class.extend = extend;
Class.mixin = mixin;
Class.ignoreFinals = false;

module.exports = Class;
},{}],24:[function(require,module,exports){
/*
 * raf.js
 * https://github.com/ngryman/raf.js
 *
 * original requestAnimationFrame polyfill by Erik Möller
 * inspired from paul_irish gist and post
 *
 * Copyright (c) 2013 ngryman
 * Licensed under the MIT license.
 */

(function(window) {
	var lastTime = 0,
		vendors = ['webkit', 'moz'],
		requestAnimationFrame = window.requestAnimationFrame,
		cancelAnimationFrame = window.cancelAnimationFrame,
		i = vendors.length;

	// try to un-prefix existing raf
	while (--i >= 0 && !requestAnimationFrame) {
		requestAnimationFrame = window[vendors[i] + 'RequestAnimationFrame'];
		cancelAnimationFrame = window[vendors[i] + 'CancelAnimationFrame'];
	}

	// polyfill with setTimeout fallback
	// heavily inspired from @darius gist mod: https://gist.github.com/paulirish/1579671#comment-837945
	if (!requestAnimationFrame || !cancelAnimationFrame) {
		requestAnimationFrame = function(callback) {
			var now = Date.now(), nextTime = Math.max(lastTime + 16, now);
			return setTimeout(function() {
				callback(lastTime = nextTime);
			}, nextTime - now);
		};

		cancelAnimationFrame = clearTimeout;
	}

	// export to window
	window.requestAnimationFrame = requestAnimationFrame;
	window.cancelAnimationFrame = cancelAnimationFrame;
}(window));
},{}],25:[function(require,module,exports){
var ARRAY_TYPE = typeof Float32Array !== "undefined" ? Float32Array : Array;

function Matrix3(m) {
    this.val = new ARRAY_TYPE(9);

    if (m) { //assume Matrix3 with val
        this.copy(m);
    } else { //default to identity
        this.idt();
    }
}

var mat3 = Matrix3.prototype;

mat3.clone = function() {
    return new Matrix3(this);
};

mat3.set = function(otherMat) {
    return this.copy(otherMat);
};

mat3.copy = function(otherMat) {
    var out = this.val,
        a = otherMat.val; 
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    return this;
};

mat3.fromMat4 = function(m) {
    var a = m.val,
        out = this.val;
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[4];
    out[4] = a[5];
    out[5] = a[6];
    out[6] = a[8];
    out[7] = a[9];
    out[8] = a[10];
    return this;
};

mat3.fromArray = function(a) {
    var out = this.val;
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    return this;
};

mat3.identity = function() {
    var out = this.val;
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 1;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 1;
    return this;
};

mat3.transpose = function() {
    var a = this.val,
        a01 = a[1], 
        a02 = a[2], 
        a12 = a[5];
    a[1] = a[3];
    a[2] = a[6];
    a[3] = a01;
    a[5] = a[7];
    a[6] = a02;
    a[7] = a12;
    return this;
};

mat3.invert = function() {
    var a = this.val,
        a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],

        b01 = a22 * a11 - a12 * a21,
        b11 = -a22 * a10 + a12 * a20,
        b21 = a21 * a10 - a11 * a20,

        // Calculate the determinant
        det = a00 * b01 + a01 * b11 + a02 * b21;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    a[0] = b01 * det;
    a[1] = (-a22 * a01 + a02 * a21) * det;
    a[2] = (a12 * a01 - a02 * a11) * det;
    a[3] = b11 * det;
    a[4] = (a22 * a00 - a02 * a20) * det;
    a[5] = (-a12 * a00 + a02 * a10) * det;
    a[6] = b21 * det;
    a[7] = (-a21 * a00 + a01 * a20) * det;
    a[8] = (a11 * a00 - a01 * a10) * det;
    return this;
};

mat3.adjoint = function() {
    var a = this.val,
        a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8];

    a[0] = (a11 * a22 - a12 * a21);
    a[1] = (a02 * a21 - a01 * a22);
    a[2] = (a01 * a12 - a02 * a11);
    a[3] = (a12 * a20 - a10 * a22);
    a[4] = (a00 * a22 - a02 * a20);
    a[5] = (a02 * a10 - a00 * a12);
    a[6] = (a10 * a21 - a11 * a20);
    a[7] = (a01 * a20 - a00 * a21);
    a[8] = (a00 * a11 - a01 * a10);
    return this;
};

mat3.determinant = function() {
    var a = this.val,
        a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8];

    return a00 * (a22 * a11 - a12 * a21) + a01 * (-a22 * a10 + a12 * a20) + a02 * (a21 * a10 - a11 * a20);
};

mat3.multiply = function(otherMat) {
    var a = this.val,
        b = otherMat.val,
        a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],

        b00 = b[0], b01 = b[1], b02 = b[2],
        b10 = b[3], b11 = b[4], b12 = b[5],
        b20 = b[6], b21 = b[7], b22 = b[8];

    a[0] = b00 * a00 + b01 * a10 + b02 * a20;
    a[1] = b00 * a01 + b01 * a11 + b02 * a21;
    a[2] = b00 * a02 + b01 * a12 + b02 * a22;

    a[3] = b10 * a00 + b11 * a10 + b12 * a20;
    a[4] = b10 * a01 + b11 * a11 + b12 * a21;
    a[5] = b10 * a02 + b11 * a12 + b12 * a22;

    a[6] = b20 * a00 + b21 * a10 + b22 * a20;
    a[7] = b20 * a01 + b21 * a11 + b22 * a21;
    a[8] = b20 * a02 + b21 * a12 + b22 * a22;
    return this;
};

mat3.translate = function(v) {
    var a = this.val,
        x = v.x, y = v.y;
    a[6] = x * a[0] + y * a[3] + a[6];
    a[7] = x * a[1] + y * a[4] + a[7];
    a[8] = x * a[2] + y * a[5] + a[8];
    return this;
};

mat3.rotate = function(rad) {
    var a = this.val,
        a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],

        s = Math.sin(rad),
        c = Math.cos(rad);

    a[0] = c * a00 + s * a10;
    a[1] = c * a01 + s * a11;
    a[2] = c * a02 + s * a12;

    a[3] = c * a10 - s * a00;
    a[4] = c * a11 - s * a01;
    a[5] = c * a12 - s * a02;
    return this;
};

mat3.scale = function(v) {
    var a = this.val,
        x = v.x, 
        y = v.y;

    a[0] = x * a[0];
    a[1] = x * a[1];
    a[2] = x * a[2];

    a[3] = y * a[3];
    a[4] = y * a[4];
    a[5] = y * a[5];
    return this;
};

mat3.fromQuat = function(q) {
    var x = q.x, y = q.y, z = q.z, w = q.w,
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        xy = x * y2,
        xz = x * z2,
        yy = y * y2,
        yz = y * z2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2,

        out = this.val;

    out[0] = 1 - (yy + zz);
    out[3] = xy + wz;
    out[6] = xz - wy;

    out[1] = xy - wz;
    out[4] = 1 - (xx + zz);
    out[7] = yz + wx;

    out[2] = xz + wy;
    out[5] = yz - wx;
    out[8] = 1 - (xx + yy);
    return this;
};

mat3.normalFromMat4 = function(m) {
    var a = m.val,
        out = this.val,

        a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32,

        // Calculate the determinant
        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;

    out[3] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[4] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[5] = (a01 * b08 - a00 * b10 - a03 * b06) * det;

    out[6] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[7] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[8] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    return this;
};

mat3.mul = mat3.multiply;

mat3.idt = mat3.identity;

//This is handy for Pool utilities, to "reset" a
//shared object to its default state
mat3.reset = mat3.idt;

mat3.toString = function() {
    var a = this.val;
    return 'Matrix3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + 
                    a[3] + ', ' + a[4] + ', ' + a[5] + ', ' + 
                    a[6] + ', ' + a[7] + ', ' + a[8] + ')';
};

mat3.str = mat3.toString;

module.exports = Matrix3;
},{}],26:[function(require,module,exports){
var ARRAY_TYPE = typeof Float32Array !== "undefined" ? Float32Array : Array;
var EPSILON = 0.000001;

function Matrix4(m) {
    this.val = new ARRAY_TYPE(16);

    if (m) { //assume Matrix4 with val
        this.copy(m);
    } else { //default to identity
        this.idt();
    }
}

var mat4 = Matrix4.prototype;

mat4.clone = function() {
    return new Matrix4(this);
};

mat4.set = function(otherMat) {
    return this.copy(otherMat);
};

mat4.copy = function(otherMat) {
    var out = this.val,
        a = otherMat.val; 
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return this;
};

mat4.fromArray = function(a) {
    var out = this.val;
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return this;
};

mat4.identity = function() {
    var out = this.val;
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return this;
};

mat4.transpose = function() {
    var a = this.val,
        a01 = a[1], a02 = a[2], a03 = a[3],
        a12 = a[6], a13 = a[7],
        a23 = a[11];

    a[1] = a[4];
    a[2] = a[8];
    a[3] = a[12];
    a[4] = a01;
    a[6] = a[9];
    a[7] = a[13];
    a[8] = a02;
    a[9] = a12;
    a[11] = a[14];
    a[12] = a03;
    a[13] = a13;
    a[14] = a23;
    return this;
};

mat4.invert = function() {
    var a = this.val,
        a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32,

        // Calculate the determinant
        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    a[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    a[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    a[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    a[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    a[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    a[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    a[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    a[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    a[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    a[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    a[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    a[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    a[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    a[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    a[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    a[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return this;
};

mat4.adjoint = function() {
    var a = this.val,
        a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    a[0]  =  (a11 * (a22 * a33 - a23 * a32) - a21 * (a12 * a33 - a13 * a32) + a31 * (a12 * a23 - a13 * a22));
    a[1]  = -(a01 * (a22 * a33 - a23 * a32) - a21 * (a02 * a33 - a03 * a32) + a31 * (a02 * a23 - a03 * a22));
    a[2]  =  (a01 * (a12 * a33 - a13 * a32) - a11 * (a02 * a33 - a03 * a32) + a31 * (a02 * a13 - a03 * a12));
    a[3]  = -(a01 * (a12 * a23 - a13 * a22) - a11 * (a02 * a23 - a03 * a22) + a21 * (a02 * a13 - a03 * a12));
    a[4]  = -(a10 * (a22 * a33 - a23 * a32) - a20 * (a12 * a33 - a13 * a32) + a30 * (a12 * a23 - a13 * a22));
    a[5]  =  (a00 * (a22 * a33 - a23 * a32) - a20 * (a02 * a33 - a03 * a32) + a30 * (a02 * a23 - a03 * a22));
    a[6]  = -(a00 * (a12 * a33 - a13 * a32) - a10 * (a02 * a33 - a03 * a32) + a30 * (a02 * a13 - a03 * a12));
    a[7]  =  (a00 * (a12 * a23 - a13 * a22) - a10 * (a02 * a23 - a03 * a22) + a20 * (a02 * a13 - a03 * a12));
    a[8]  =  (a10 * (a21 * a33 - a23 * a31) - a20 * (a11 * a33 - a13 * a31) + a30 * (a11 * a23 - a13 * a21));
    a[9]  = -(a00 * (a21 * a33 - a23 * a31) - a20 * (a01 * a33 - a03 * a31) + a30 * (a01 * a23 - a03 * a21));
    a[10] =  (a00 * (a11 * a33 - a13 * a31) - a10 * (a01 * a33 - a03 * a31) + a30 * (a01 * a13 - a03 * a11));
    a[11] = -(a00 * (a11 * a23 - a13 * a21) - a10 * (a01 * a23 - a03 * a21) + a20 * (a01 * a13 - a03 * a11));
    a[12] = -(a10 * (a21 * a32 - a22 * a31) - a20 * (a11 * a32 - a12 * a31) + a30 * (a11 * a22 - a12 * a21));
    a[13] =  (a00 * (a21 * a32 - a22 * a31) - a20 * (a01 * a32 - a02 * a31) + a30 * (a01 * a22 - a02 * a21));
    a[14] = -(a00 * (a11 * a32 - a12 * a31) - a10 * (a01 * a32 - a02 * a31) + a30 * (a01 * a12 - a02 * a11));
    a[15] =  (a00 * (a11 * a22 - a12 * a21) - a10 * (a01 * a22 - a02 * a21) + a20 * (a01 * a12 - a02 * a11));
    return this;
};

mat4.determinant = function () {
    var a = this.val,
        a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32;

    // Calculate the determinant
    return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
};

mat4.multiply = function(otherMat) {
    var a = this.val,
        b = otherMat.val,
        a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    // Cache only the current line of the second matrix
    var b0  = b[0], b1 = b[1], b2 = b[2], b3 = b[3];  
    a[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    a[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    a[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    a[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    a[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    a[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    a[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    a[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    a[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    a[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    a[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    a[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    a[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    a[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    a[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    a[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    return this;
};

mat4.translate = function(v) {
    var x = v.x, y = v.y, z = v.z,
        a = this.val;
    a[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    a[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    a[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    a[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    return this;
};

mat4.scale = function(v) {
    var x = v.x, y = v.y, z = v.z, a = this.val;

    a[0] = a[0] * x;
    a[1] = a[1] * x;
    a[2] = a[2] * x;
    a[3] = a[3] * x;
    a[4] = a[4] * y;
    a[5] = a[5] * y;
    a[6] = a[6] * y;
    a[7] = a[7] * y;
    a[8] = a[8] * z;
    a[9] = a[9] * z;
    a[10] = a[10] * z;
    a[11] = a[11] * z;
    a[12] = a[12];
    a[13] = a[13];
    a[14] = a[14];
    a[15] = a[15];
    return this;
};

mat4.rotate = function (rad, axis) {
    var a = this.val,
        x = axis.x, y = axis.y, z = axis.z,
        len = Math.sqrt(x * x + y * y + z * z),
        s, c, t,
        a00, a01, a02, a03,
        a10, a11, a12, a13,
        a20, a21, a22, a23,
        b00, b01, b02,
        b10, b11, b12,
        b20, b21, b22;

    if (Math.abs(len) < EPSILON) { return null; }
    
    len = 1 / len;
    x *= len;
    y *= len;
    z *= len;

    s = Math.sin(rad);
    c = Math.cos(rad);
    t = 1 - c;

    a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
    a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
    a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

    // Construct the elements of the rotation matrix
    b00 = x * x * t + c; b01 = y * x * t + z * s; b02 = z * x * t - y * s;
    b10 = x * y * t - z * s; b11 = y * y * t + c; b12 = z * y * t + x * s;
    b20 = x * z * t + y * s; b21 = y * z * t - x * s; b22 = z * z * t + c;

    // Perform rotation-specific matrix multiplication
    a[0] = a00 * b00 + a10 * b01 + a20 * b02;
    a[1] = a01 * b00 + a11 * b01 + a21 * b02;
    a[2] = a02 * b00 + a12 * b01 + a22 * b02;
    a[3] = a03 * b00 + a13 * b01 + a23 * b02;
    a[4] = a00 * b10 + a10 * b11 + a20 * b12;
    a[5] = a01 * b10 + a11 * b11 + a21 * b12;
    a[6] = a02 * b10 + a12 * b11 + a22 * b12;
    a[7] = a03 * b10 + a13 * b11 + a23 * b12;
    a[8] = a00 * b20 + a10 * b21 + a20 * b22;
    a[9] = a01 * b20 + a11 * b21 + a21 * b22;
    a[10] = a02 * b20 + a12 * b21 + a22 * b22;
    a[11] = a03 * b20 + a13 * b21 + a23 * b22;
    return this;
};

mat4.rotateX = function(rad) {
    var a = this.val,
        s = Math.sin(rad),
        c = Math.cos(rad),
        a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7],
        a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];

    // Perform axis-specific matrix multiplication
    a[4] = a10 * c + a20 * s;
    a[5] = a11 * c + a21 * s;
    a[6] = a12 * c + a22 * s;
    a[7] = a13 * c + a23 * s;
    a[8] = a20 * c - a10 * s;
    a[9] = a21 * c - a11 * s;
    a[10] = a22 * c - a12 * s;
    a[11] = a23 * c - a13 * s;
    return this;
};

mat4.rotateY = function(rad) {
    var a = this.val,
        s = Math.sin(rad),
        c = Math.cos(rad),
        a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3],
        a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];

    // Perform axis-specific matrix multiplication
    a[0] = a00 * c - a20 * s;
    a[1] = a01 * c - a21 * s;
    a[2] = a02 * c - a22 * s;
    a[3] = a03 * c - a23 * s;
    a[8] = a00 * s + a20 * c;
    a[9] = a01 * s + a21 * c;
    a[10] = a02 * s + a22 * c;
    a[11] = a03 * s + a23 * c;
    return this;
};

mat4.rotateZ = function (rad) {
    var a = this.val,
        s = Math.sin(rad),
        c = Math.cos(rad),
        a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3],
        a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];

    // Perform axis-specific matrix multiplication
    a[0] = a00 * c + a10 * s;
    a[1] = a01 * c + a11 * s;
    a[2] = a02 * c + a12 * s;
    a[3] = a03 * c + a13 * s;
    a[4] = a10 * c - a00 * s;
    a[5] = a11 * c - a01 * s;
    a[6] = a12 * c - a02 * s;
    a[7] = a13 * c - a03 * s;
    return this;
};

mat4.fromRotationTranslation = function (q, v) {
    // Quaternion math
    var out = this.val,
        x = q.x, y = q.y, z = q.z, w = q.w,
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        xy = x * y2,
        xz = x * z2,
        yy = y * y2,
        yz = y * z2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - (yy + zz);
    out[1] = xy + wz;
    out[2] = xz - wy;
    out[3] = 0;
    out[4] = xy - wz;
    out[5] = 1 - (xx + zz);
    out[6] = yz + wx;
    out[7] = 0;
    out[8] = xz + wy;
    out[9] = yz - wx;
    out[10] = 1 - (xx + yy);
    out[11] = 0;
    out[12] = v.x;
    out[13] = v.y;
    out[14] = v.z;
    out[15] = 1;
    return this;
};

mat4.fromQuat = function (q) {
    var out = this.val,
        x = q.x, y = q.y, z = q.z, w = q.w,
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        xy = x * y2,
        xz = x * z2,
        yy = y * y2,
        yz = y * z2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - (yy + zz);
    out[1] = xy + wz;
    out[2] = xz - wy;
    out[3] = 0;

    out[4] = xy - wz;
    out[5] = 1 - (xx + zz);
    out[6] = yz + wx;
    out[7] = 0;

    out[8] = xz + wy;
    out[9] = yz - wx;
    out[10] = 1 - (xx + yy);
    out[11] = 0;

    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;

    return this;
};


/**
 * Generates a frustum matrix with the given bounds
 *
 * @param {Number} left Left bound of the frustum
 * @param {Number} right Right bound of the frustum
 * @param {Number} bottom Bottom bound of the frustum
 * @param {Number} top Top bound of the frustum
 * @param {Number} near Near bound of the frustum
 * @param {Number} far Far bound of the frustum
 * @returns {Matrix4} this for chaining
 */
mat4.frustum = function (left, right, bottom, top, near, far) {
    var out = this.val,
        rl = 1 / (right - left),
        tb = 1 / (top - bottom),
        nf = 1 / (near - far);
    out[0] = (near * 2) * rl;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = (near * 2) * tb;
    out[6] = 0;
    out[7] = 0;
    out[8] = (right + left) * rl;
    out[9] = (top + bottom) * tb;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (far * near * 2) * nf;
    out[15] = 0;
    return this;
};


/**
 * Generates a perspective projection matrix with the given bounds
 *
 * @param {number} fovy Vertical field of view in radians
 * @param {number} aspect Aspect ratio. typically viewport width/height
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {Matrix4} this for chaining
 */
mat4.perspective = function (fovy, aspect, near, far) {
    var out = this.val,
        f = 1.0 / Math.tan(fovy / 2),
        nf = 1 / (near - far);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) * nf;
    out[15] = 0;
    return this;
};

/**
 * Generates a orthogonal projection matrix with the given bounds
 *
 * @param {number} left Left bound of the frustum
 * @param {number} right Right bound of the frustum
 * @param {number} bottom Bottom bound of the frustum
 * @param {number} top Top bound of the frustum
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {Matrix4} this for chaining
 */
mat4.ortho = function (left, right, bottom, top, near, far) {
    var out = this.val,
        lr = 1 / (left - right),
        bt = 1 / (bottom - top),
        nf = 1 / (near - far);
    out[0] = -2 * lr;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = -2 * bt;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 2 * nf;
    out[11] = 0;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return this;
};

/**
 * Generates a look-at matrix with the given eye position, focal point, and up axis
 *
 * @param {Vector3} eye Position of the viewer
 * @param {Vector3} center Point the viewer is looking at
 * @param {Vector3} up vec3 pointing up
 * @returns {Matrix4} this for chaining
 */
mat4.lookAt = function (eye, center, up) {
    var out = this.val,

        x0, x1, x2, y0, y1, y2, z0, z1, z2, len,
        eyex = eye.x,
        eyey = eye.y,
        eyez = eye.z,
        upx = up.x,
        upy = up.y,
        upz = up.z,
        centerx = center.x,
        centery = center.y,
        centerz = center.z;

    if (Math.abs(eyex - centerx) < EPSILON &&
        Math.abs(eyey - centery) < EPSILON &&
        Math.abs(eyez - centerz) < EPSILON) {
        return this.identity();
    }

    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;

    len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;

    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (!len) {
        x0 = 0;
        x1 = 0;
        x2 = 0;
    } else {
        len = 1 / len;
        x0 *= len;
        x1 *= len;
        x2 *= len;
    }

    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;

    len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
    if (!len) {
        y0 = 0;
        y1 = 0;
        y2 = 0;
    } else {
        len = 1 / len;
        y0 *= len;
        y1 *= len;
        y2 *= len;
    }

    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;

    return this;
};


mat4.mul = mat4.multiply;

mat4.idt = mat4.identity;

//This is handy for Pool utilities, to "reset" a
//shared object to its default state
mat4.reset = mat4.idt;

mat4.toString = function () {
    var a = this.val;
    return 'Matrix4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' +
                    a[4] + ', ' + a[5] + ', ' + a[6] + ', ' + a[7] + ', ' +
                    a[8] + ', ' + a[9] + ', ' + a[10] + ', ' + a[11] + ', ' + 
                    a[12] + ', ' + a[13] + ', ' + a[14] + ', ' + a[15] + ')';
};

mat4.str = mat4.toString;

module.exports = Matrix4;

},{}],27:[function(require,module,exports){
var Vector3 = require('./Vector3');
var Matrix3 = require('./Matrix3');
var common = require('./common');

//some shared 'private' arrays
var s_iNext = (typeof Int8Array !== 'undefined' ? new Int8Array([1,2,0]) : [1,2,0]);
var tmp = (typeof Float32Array !== 'undefined' ? new Float32Array([0,0,0]) : [0,0,0]);

var xUnitVec3 = new Vector3(1, 0, 0);
var yUnitVec3 = new Vector3(0, 1, 0);
var tmpvec = new Vector3();

var tmpMat3 = new Matrix3();

function Quaternion(x, y, z, w) {
	if (typeof x === "object") {
        this.x = x.x||0;
        this.y = x.y||0;
        this.z = x.z||0;
        this.w = x.w||0;
    } else {
        this.x = x||0;
        this.y = y||0;
        this.z = z||0;
        this.w = w||0;
    }
}

var quat = Quaternion.prototype;

//mixin common functions
for (var k in common) {
    quat[k] = common[k];
}

quat.rotationTo = function(a, b) {
    var dot = a.x * b.x + a.y * b.y + a.z * b.z; //a.dot(b)
    if (dot < -0.999999) {
        if (tmpvec.copy(xUnitVec3).cross(a).len() < 0.000001)
            tmpvec.copy(yUnitVec3).cross(a);
        
        tmpvec.normalize();
        return this.setAxisAngle(tmpvec, Math.PI);
    } else if (dot > 0.999999) {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.w = 1;
        return this;
    } else {
        tmpvec.copy(a).cross(b);
        this.x = tmpvec.x;
        this.y = tmpvec.y;
        this.z = tmpvec.z;
        this.w = 1 + dot;
        return this.normalize();
    }
};

quat.setAxes = function(view, right, up) {
    var m = tmpMat3.val;
    m[0] = right.x;
    m[3] = right.y;
    m[6] = right.z;

    m[1] = up.x;
    m[4] = up.y;
    m[7] = up.z;

    m[2] = -view.x;
    m[5] = -view.y;
    m[8] = -view.z;

    return this.fromMat3(tmpMat3).normalize();
};

quat.identity = function() {
    this.x = this.y = this.z = 0;
    this.w = 1;
    return this;
};

quat.setAxisAngle = function(axis, rad) {
    rad = rad * 0.5;
    var s = Math.sin(rad);
    this.x = s * axis.x;
    this.y = s * axis.y;
    this.z = s * axis.z;
    this.w = Math.cos(rad);
    return this;
};

quat.multiply = function(b) {
    var ax = this.x, ay = this.y, az = this.z, aw = this.w,
        bx = b.x, by = b.y, bz = b.z, bw = b.w;

    this.x = ax * bw + aw * bx + ay * bz - az * by;
    this.y = ay * bw + aw * by + az * bx - ax * bz;
    this.z = az * bw + aw * bz + ax * by - ay * bx;
    this.w = aw * bw - ax * bx - ay * by - az * bz;
    return this;
};

quat.slerp = function (b, t) {
    // benchmarks:
    //    http://jsperf.com/quaternion-slerp-implementations

    var ax = this.x, ay = this.y, az = this.y, aw = this.y,
        bx = b.x, by = b.y, bz = b.z, bw = b.w;

    var        omega, cosom, sinom, scale0, scale1;

    // calc cosine
    cosom = ax * bx + ay * by + az * bz + aw * bw;
    // adjust signs (if necessary)
    if ( cosom < 0.0 ) {
        cosom = -cosom;
        bx = - bx;
        by = - by;
        bz = - bz;
        bw = - bw;
    }
    // calculate coefficients
    if ( (1.0 - cosom) > 0.000001 ) {
        // standard case (slerp)
        omega  = Math.acos(cosom);
        sinom  = Math.sin(omega);
        scale0 = Math.sin((1.0 - t) * omega) / sinom;
        scale1 = Math.sin(t * omega) / sinom;
    } else {        
        // "from" and "to" quaternions are very close 
        //  ... so we can do a linear interpolation
        scale0 = 1.0 - t;
        scale1 = t;
    }
    // calculate final values
    this.x = scale0 * ax + scale1 * bx;
    this.y = scale0 * ay + scale1 * by;
    this.z = scale0 * az + scale1 * bz;
    this.w = scale0 * aw + scale1 * bw;
    return this;
};

quat.invert = function() {
    var a0 = this.x, a1 = this.y, a2 = this.z, a3 = this.w,
        dot = a0*a0 + a1*a1 + a2*a2 + a3*a3,
        invDot = dot ? 1.0/dot : 0;
    
    // TODO: Would be faster to return [0,0,0,0] immediately if dot == 0

    this.x = -a0*invDot;
    this.y = -a1*invDot;
    this.z = -a2*invDot;
    this.w = a3*invDot;
    return this;
};

quat.conjugate = function() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
};

quat.rotateX = function (rad) {
    rad *= 0.5; 

    var ax = this.x, ay = this.y, az = this.z, aw = this.w,
        bx = Math.sin(rad), bw = Math.cos(rad);

    this.x = ax * bw + aw * bx;
    this.y = ay * bw + az * bx;
    this.z = az * bw - ay * bx;
    this.w = aw * bw - ax * bx;
    return this;
};

quat.rotateY = function (rad) {
    rad *= 0.5; 

    var ax = this.x, ay = this.y, az = this.z, aw = this.w,
        by = Math.sin(rad), bw = Math.cos(rad);

    this.x = ax * bw - az * by;
    this.y = ay * bw + aw * by;
    this.z = az * bw + ax * by;
    this.w = aw * bw - ay * by;
    return this;
};

quat.rotateZ = function (rad) {
    rad *= 0.5; 

    var ax = this.x, ay = this.y, az = this.z, aw = this.w,
        bz = Math.sin(rad), bw = Math.cos(rad);

    this.x = ax * bw + ay * bz;
    this.y = ay * bw - ax * bz;
    this.z = az * bw + aw * bz;
    this.w = aw * bw - az * bz;
    return this;
};

quat.calculateW = function () {
    var x = this.x, y = this.y, z = this.z;

    this.x = x;
    this.y = y;
    this.z = z;
    this.w = -Math.sqrt(Math.abs(1.0 - x * x - y * y - z * z));
    return this;
};

quat.fromMat3 = function(mat) {
    // benchmarks:
    //    http://jsperf.com/typed-array-access-speed
    //    http://jsperf.com/conversion-of-3x3-matrix-to-quaternion

    // Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
    // article "Quaternion Calculus and Fast Animation".
    var m = mat.val,
        fTrace = m[0] + m[4] + m[8];
    var fRoot;

    if ( fTrace > 0.0 ) {
        // |w| > 1/2, may as well choose w > 1/2
        fRoot = Math.sqrt(fTrace + 1.0);  // 2w
        this.w = 0.5 * fRoot;
        fRoot = 0.5/fRoot;  // 1/(4w)
        this.x = (m[7]-m[5])*fRoot;
        this.y = (m[2]-m[6])*fRoot;
        this.z = (m[3]-m[1])*fRoot;
    } else {
        // |w| <= 1/2
        var i = 0;
        if ( m[4] > m[0] )
          i = 1;
        if ( m[8] > m[i*3+i] )
          i = 2;
        var j = s_iNext[i];
        var k = s_iNext[j];
            
        //This isn't quite as clean without array access...
        fRoot = Math.sqrt(m[i*3+i]-m[j*3+j]-m[k*3+k] + 1.0);
        tmp[i] = 0.5 * fRoot;

        fRoot = 0.5 / fRoot;
        tmp[j] = (m[j*3+i] + m[i*3+j]) * fRoot;
        tmp[k] = (m[k*3+i] + m[i*3+k]) * fRoot;

        this.x = tmp[0];
        this.y = tmp[1];
        this.z = tmp[2];
        this.w = (m[k*3+j] - m[j*3+k]) * fRoot;
    }
    
    return this;
};

quat.idt = quat.identity;

quat.sub = quat.subtract;

quat.mul = quat.multiply;

quat.len = quat.length;

quat.lenSq = quat.lengthSq;

//This is handy for Pool utilities, to "reset" a
//shared object to its default state
quat.reset = quat.idt;


quat.toString = function() {
    return 'Quaternion(' + this.x + ', ' + this.y + ', ' + this.z + ', ' + this.w + ')';
};

quat.str = quat.toString;

module.exports = Quaternion;
},{"./Matrix3":25,"./Vector3":29,"./common":31}],28:[function(require,module,exports){
function Vector2(x, y) {
	if (typeof x === "object") {
        this.x = x.x||0;
        this.y = x.y||0;
    } else {
        this.x = x||0;
        this.y = y||0;
    }
}

//shorthand it for better minification
var vec2 = Vector2.prototype;

/**
 * Returns a new instance of Vector2 with
 * this vector's components. 
 * @return {Vector2} a clone of this vector
 */
vec2.clone = function() {
    return new Vector2(this.x, this.y);
};

/**
 * Copies the x, y components from the specified
 * Vector. Any undefined components from `otherVec`
 * will default to zero.
 * 
 * @param  {otherVec} the other Vector2 to copy
 * @return {Vector2}  this, for chaining
 */
vec2.copy = function(otherVec) {
    this.x = otherVec.x||0;
    this.y = otherVec.y||0;
    return this;
};

/**
 * A convenience function to set the components of
 * this vector as x and y. Falsy or undefined
 * parameters will default to zero.
 *
 * You can also pass a vector object instead of
 * individual components, to copy the object's components.
 * 
 * @param {Number} x the x component
 * @param {Number} y the y component
 * @return {Vector2}  this, for chaining
 */
vec2.set = function(x, y) {
    if (typeof x === "object") {
        this.x = x.x||0;
        this.y = x.y||0;
    } else {
        this.x = x||0;
        this.y = y||0;
    }
    return this;
};

vec2.add = function(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
};

vec2.subtract = function(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
};

vec2.multiply = function(v) {
    this.x *= v.x;
    this.y *= v.y;
    return this;
};

vec2.scale = function(s) {
    this.x *= s;
    this.y *= s;
    return this;
};

vec2.divide = function(v) {
    this.x /= v.x;
    this.y /= v.y;
    return this;
};

vec2.negate = function() {
    this.x = -this.x;
    this.y = -this.y;
    return this;
};

vec2.distance = function(v) {
    var dx = v.x - this.x,
        dy = v.y - this.y;
    return Math.sqrt(dx*dx + dy*dy);
};

vec2.distanceSq = function(v) {
    var dx = v.x - this.x,
        dy = v.y - this.y;
    return dx*dx + dy*dy;
};

vec2.length = function() {
    var x = this.x,
        y = this.y;
    return Math.sqrt(x*x + y*y);
};

vec2.lengthSq = function() {
    var x = this.x,
        y = this.y;
    return x*x + y*y;
};

vec2.normalize = function() {
    var x = this.x,
        y = this.y;
    var len = x*x + y*y;
    if (len > 0) {
        len = 1 / Math.sqrt(len);
        this.x = x*len;
        this.y = y*len;
    }
    return this;
};

vec2.dot = function(v) {
    return this.x * v.x + this.y * v.y;
};

//Unlike Vector3, this returns a scalar
//http://allenchou.net/2013/07/cross-product-of-2d-vectors/
vec2.cross = function(v) {
    return this.x * v.y - this.y * v.x;
};

vec2.lerp = function(v, t) {
    var ax = this.x,
        ay = this.y;
    t = t||0;
    this.x = ax + t * (v.x - ax);
    this.y = ay + t * (v.y - ay);
    return this;
};

vec2.transformMat3 = function(mat) {
    var x = this.x, y = this.y, m = mat.val;
    this.x = m[0] * x + m[2] * y + m[4];
    this.y = m[1] * x + m[3] * y + m[5];
    return this;
};

vec2.transformMat4 = function(mat) {
    var x = this.x, 
        y = this.y,
        m = mat.val;
    this.x = m[0] * x + m[4] * y + m[12];
    this.y = m[1] * x + m[5] * y + m[13];
    return this;
};

vec2.reset = function() {
    this.x = 0;
    this.y = 0;
    return this;
};

vec2.sub = vec2.subtract;

vec2.mul = vec2.multiply;

vec2.div = vec2.divide;

vec2.dist = vec2.distance;

vec2.distSq = vec2.distanceSq;

vec2.len = vec2.length;

vec2.lenSq = vec2.lengthSq;

vec2.toString = function() {
    return 'Vector2(' + this.x + ', ' + this.y + ')';
};

vec2.random = function(scale) {
    scale = scale || 1.0;
    var r = Math.random() * 2.0 * Math.PI;
    this.x = Math.cos(r) * scale;
    this.y = Math.sin(r) * scale;
    return this;
};

vec2.str = vec2.toString;

module.exports = Vector2;
},{}],29:[function(require,module,exports){
function Vector3(x, y, z) {
    if (typeof x === "object") {
        this.x = x.x||0;
        this.y = x.y||0;
        this.z = x.z||0;
    } else {
        this.x = x||0;
        this.y = y||0;
        this.z = z||0;
    }
}

//shorthand it for better minification
var vec3 = Vector3.prototype;

vec3.clone = function() {
    return new Vector3(this.x, this.y, this.z);
};

vec3.copy = function(otherVec) {
    this.x = otherVec.x;
    this.y = otherVec.y;
    this.z = otherVec.z;
    return this;
};

vec3.set = function(x, y, z) {
    if (typeof x === "object") {
        this.x = x.x||0;
        this.y = x.y||0;
        this.z = x.z||0;
    } else {
        this.x = x||0;
        this.y = y||0;
        this.z = z||0;
    }
    return this;
};

vec3.add = function(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
};

vec3.subtract = function(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
};

vec3.multiply = function(v) {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    return this;
};

vec3.scale = function(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
};

vec3.divide = function(v) {
    this.x /= v.x;
    this.y /= v.y;
    this.z /= v.z;
    return this;
};

vec3.negate = function() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
};

vec3.distance = function(v) {
    var dx = v.x - this.x,
        dy = v.y - this.y,
        dz = v.z - this.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
};

vec3.distanceSq = function(v) {
    var dx = v.x - this.x,
        dy = v.y - this.y,
        dz = v.z - this.z;
    return dx*dx + dy*dy + dz*dz;
};

vec3.length = function() {
    var x = this.x,
        y = this.y,
        z = this.z;
    return Math.sqrt(x*x + y*y + z*z);
};

vec3.lengthSq = function() {
    var x = this.x,
        y = this.y,
        z = this.z;
    return x*x + y*y + z*z;
};

vec3.normalize = function() {
    var x = this.x,
        y = this.y,
        z = this.z;
    var len = x*x + y*y + z*z;
    if (len > 0) {
        len = 1 / Math.sqrt(len);
        this.x = x*len;
        this.y = y*len;
        this.z = z*len;
    }
    return this;
};

vec3.dot = function(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
};

vec3.cross = function(v) {
    var ax = this.x, ay = this.y, az = this.z,
        bx = v.x, by = v.y, bz = v.z;

    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
};

vec3.lerp = function(v, t) {
    var ax = this.x,
        ay = this.y,
        az = this.z;
    t = t||0;
    this.x = ax + t * (v.x - ax);
    this.y = ay + t * (v.y - ay);
    this.z = az + t * (v.z - az);
    return this;
};

vec3.transformMat4 = function(mat) {
    var x = this.x, y = this.y, z = this.z, m = mat.val;
    this.x = m[0] * x + m[4] * y + m[8] * z + m[12];
    this.y = m[1] * x + m[5] * y + m[9] * z + m[13];
    this.z = m[2] * x + m[6] * y + m[10] * z + m[14];
    return this;
};

vec3.transformMat3 = function(mat) {
    var x = this.x, y = this.y, z = this.z, m = mat.val;
    this.x = x * m[0] + y * m[3] + z * m[6];
    this.y = x * m[1] + y * m[4] + z * m[7];
    this.z = x * m[2] + y * m[5] + z * m[8];
    return this;
};

vec3.transformQuat = function(q) {
    // benchmarks: http://jsperf.com/quaternion-transform-vec3-implementations
    var x = this.x, y = this.y, z = this.z,
        qx = q.x, qy = q.y, qz = q.z, qw = q.w,

        // calculate quat * vec
        ix = qw * x + qy * z - qz * y,
        iy = qw * y + qz * x - qx * z,
        iz = qw * z + qx * y - qy * x,
        iw = -qx * x - qy * y - qz * z;

    // calculate result * inverse quat
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return this;
};

/**
 * Multiplies this Vector3 by the specified matrix, 
 * applying a W divide. This is useful for projection,
 * e.g. unprojecting a 2D point into 3D space.
 *
 * @method  prj
 * @param {Matrix4} the 4x4 matrix to multiply with 
 * @return {Vector3} this object for chaining
 */
vec3.project = function(mat) {
    var x = this.x,
        y = this.y,
        z = this.z,
        m = mat.val,
        a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3],
        a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
        a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11],
        a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

    var l_w = 1 / (x * a03 + y * a13 + z * a23 + a33);

    this.x = (x * a00 + y * a10 + z * a20 + a30) * l_w; 
    this.y = (x * a01 + y * a11 + z * a21 + a31) * l_w; 
    this.z = (x * a02 + y * a12 + z * a22 + a32) * l_w;
    return this;
};

/**
 * Unproject this point from 2D space to 3D space.
 * The point should have its x and y properties set to
 * 2D screen space, and the z either at 0 (near plane)
 * or 1 (far plane). The provided matrix is assumed to already
 * be combined, i.e. projection * view * model.
 *
 * After this operation, this vector's (x, y, z) components will
 * represent the unprojected 3D coordinate.
 * 
 * @param  {Vector4} viewport          screen x, y, width and height in pixels
 * @param  {Matrix4} invProjectionView combined projection and view matrix
 * @return {Vector3}                   this object, for chaining
 */
vec3.unproject = function(viewport, invProjectionView) {
    var viewX = viewport.x,
        viewY = viewport.y,
        viewWidth = viewport.z,
        viewHeight = viewport.w;
    
    var x = this.x, 
        y = this.y,
        z = this.z;

    x = x - viewX;
    y = viewHeight - y - 1;
    y = y - viewY;

    this.x = (2 * x) / viewWidth - 1;
    this.y = (2 * y) / viewHeight - 1;
    this.z = 2 * z - 1;

    return this.project(invProjectionView);
};

vec3.random = function(scale) {
    scale = scale || 1.0;

    var r = Math.random() * 2.0 * Math.PI;
    var z = (Math.random() * 2.0) - 1.0;
    var zScale = Math.sqrt(1.0-z*z) * scale;
    
    this.x = Math.cos(r) * zScale;
    this.y = Math.sin(r) * zScale;
    this.z = z * scale;
    return this;
};

vec3.reset = function() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    return this;
};


vec3.sub = vec3.subtract;

vec3.mul = vec3.multiply;

vec3.div = vec3.divide;

vec3.dist = vec3.distance;

vec3.distSq = vec3.distanceSq;

vec3.len = vec3.length;

vec3.lenSq = vec3.lengthSq;

vec3.toString = function() {
    return 'Vector3(' + this.x + ', ' + this.y + ', ' + this.z + ')';
};

vec3.str = vec3.toString;

module.exports = Vector3;
},{}],30:[function(require,module,exports){
var common = require('./common');

function Vector4(x, y, z, w) {
	if (typeof x === "object") {
        this.x = x.x||0;
        this.y = x.y||0;
        this.z = x.z||0;
        this.w = x.w||0;
    } else {
        this.x = x||0;
        this.y = y||0;
        this.z = z||0;
        this.w = w||0;
    }
}

//shorthand it for better minification
var vec4 = Vector4.prototype;

//mixin common functions
for (var k in common) {
    vec4[k] = common[k];
}

vec4.clone = function() {
    return new Vector4(this.x, this.y, this.z, this.w);
};

vec4.multiply = function(v) {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    this.w *= v.w;
    return this;
};

vec4.divide = function(v) {
    this.x /= v.x;
    this.y /= v.y;
    this.z /= v.z;
    this.w /= v.w;
    return this;
};

vec4.distance = function(v) {
    var dx = v.x - this.x,
        dy = v.y - this.y,
        dz = v.z - this.z,
        dw = v.w - this.w;
    return Math.sqrt(dx*dx + dy*dy + dz*dz + dw*dw);
};

vec4.distanceSq = function(v) {
    var dx = v.x - this.x,
        dy = v.y - this.y,
        dz = v.z - this.z,
        dw = v.w - this.w;
    return dx*dx + dy*dy + dz*dz + dw*dw;
};

vec4.negate = function() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    this.w = -this.w;
    return this;
};

vec4.transformMat4 = function(mat) {
    var m = mat.val, x = this.x, y = this.y, z = this.z, w = this.w;
    this.x = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    this.y = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    this.z = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    this.w = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    return this;
};

//// TODO: is this really the same as Vector3 ??
///  Also, what about this:
///  http://molecularmusings.wordpress.com/2013/05/24/a-faster-quaternion-vector-multiplication/
vec4.transformQuat = function(q) {
    // benchmarks: http://jsperf.com/quaternion-transform-vec3-implementations
    var x = this.x, y = this.y, z = this.z,
        qx = q.x, qy = q.y, qz = q.z, qw = q.w,

        // calculate quat * vec
        ix = qw * x + qy * z - qz * y,
        iy = qw * y + qz * x - qx * z,
        iz = qw * z + qx * y - qy * x,
        iw = -qx * x - qy * y - qz * z;

    // calculate result * inverse quat
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return this;
};

vec4.random = function(scale) {
    scale = scale || 1.0;

    //Not spherical; should fix this for more uniform distribution
    this.x = (Math.random() * 2 - 1) * scale;
    this.y = (Math.random() * 2 - 1) * scale;
    this.z = (Math.random() * 2 - 1) * scale;
    this.w = (Math.random() * 2 - 1) * scale;
    return this;
};

vec4.reset = function() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 0;
    return this;
};

vec4.sub = vec4.subtract;

vec4.mul = vec4.multiply;

vec4.div = vec4.divide;

vec4.dist = vec4.distance;

vec4.distSq = vec4.distanceSq;

vec4.len = vec4.length;

vec4.lenSq = vec4.lengthSq;

vec4.toString = function() {
    return 'Vector4(' + this.x + ', ' + this.y + ', ' + this.z + ', ' + this.w + ')';
};

vec4.str = vec4.toString;

module.exports = Vector4;
},{"./common":31}],31:[function(require,module,exports){
//common vec4 functions
module.exports = {
    
/**
 * Copies the x, y, z, w components from the specified
 * Vector. Unlike most other operations, this function
 * will default undefined components on `otherVec` to zero.
 * 
 * @method  copy
 * @param  {otherVec} the other Vector4 to copy
 * @return {Vector}  this, for chaining
 */


/**
 * A convenience function to set the components of
 * this vector as x, y, z, w. Falsy or undefined
 * parameters will default to zero.
 *
 * You can also pass a vector object instead of
 * individual components, to copy the object's components.
 * 
 * @method  set
 * @param {Number} x the x component
 * @param {Number} y the y component
 * @param {Number} z the z component
 * @param {Number} w the w component
 * @return {Vector2}  this, for chaining
 */

/**
 * Adds the components of the other Vector4 to
 * this vector.
 * 
 * @method add
 * @param  {Vector4} otherVec other vector, right operand
 * @return {Vector2}  this, for chaining
 */

/**
 * Subtracts the components of the other Vector4
 * from this vector. Aliased as `sub()`
 * 
 * @method  subtract
 * @param  {Vector4} otherVec other vector, right operand
 * @return {Vector2}  this, for chaining
 */

/**
 * Multiplies the components of this Vector4
 * by a scalar amount.
 *
 * @method  scale
 * @param {Number} s the scale to multiply by
 * @return {Vector4} this, for chaining
 */

/**
 * Returns the magnitude (length) of this vector.
 *
 * Aliased as `len()`
 * 
 * @method  length
 * @return {Number} the length of this vector
 */

/**
 * Returns the squared magnitude (length) of this vector.
 *
 * Aliased as `lenSq()`
 * 
 * @method  lengthSq
 * @return {Number} the squared length of this vector
 */

/**
 * Normalizes this vector to a unit vector.
 * @method normalize
 * @return {Vector4}  this, for chaining
 */

/**
 * Returns the dot product of this vector
 * and the specified Vector4.
 * 
 * @method dot
 * @return {Number} the dot product
 */
    copy: function(otherVec) {
        this.x = otherVec.x||0;
        this.y = otherVec.y||0;
        this.z = otherVec.z||0;
        this.w = otherVec.w||0;
        return this;
    },

    set: function(x, y, z, w) {
        if (typeof x === "object") {
            this.x = x.x||0;
            this.y = x.y||0;
            this.z = x.z||0;
            this.w = x.w||0;
        } else {
            this.x = x||0;
            this.y = y||0;
            this.z = z||0;
            this.w = w||0;

        }
        return this;
    },

    add: function(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        this.w += v.w;
        return this;
    },

    subtract: function(v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        this.w -= v.w;
        return this;
    },

    scale: function(s) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        this.w *= s;
        return this;
    },


    length: function() {
        var x = this.x,
            y = this.y,
            z = this.z,
            w = this.w;
        return Math.sqrt(x*x + y*y + z*z + w*w);
    },

    lengthSq: function() {
        var x = this.x,
            y = this.y,
            z = this.z,
            w = this.w;
        return x*x + y*y + z*z + w*w;
    },

    normalize: function() {
        var x = this.x,
            y = this.y,
            z = this.z,
            w = this.w;
        var len = x*x + y*y + z*z + w*w;
        if (len > 0) {
            len = 1 / Math.sqrt(len);
            this.x = x*len;
            this.y = y*len;
            this.z = z*len;
            this.w = w*len;
        }
        return this;
    },

    dot: function(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z + this.w * v.w;
    },

    lerp: function(v, t) {
        var ax = this.x,
            ay = this.y,
            az = this.z,
            aw = this.w;
        t = t||0;
        this.x = ax + t * (v.x - ax);
        this.y = ay + t * (v.y - ay);
        this.z = az + t * (v.z - az);
        this.w = aw + t * (v.w - aw);
        return this;
    }
};
},{}],32:[function(require,module,exports){
module.exports = {
    Vector2: require('./Vector2'),
    Vector3: require('./Vector3'),
    Vector4: require('./Vector4'),
    Matrix3: require('./Matrix3'),
    Matrix4: require('./Matrix4'),
    Quaternion: require('./Quaternion')
};
},{"./Matrix3":25,"./Matrix4":26,"./Quaternion":27,"./Vector2":28,"./Vector3":29,"./Vector4":30}],33:[function(require,module,exports){
var Class = require('klasse');

var Constraint = new Class({

	initialize: function (p1, p2, restingDistance, stiffness, tearDistance) {
		this.p1 = p1;
		this.p2 = p2;
		this.stiffness = stiffness || 1.0;
		//optional -- a falsy value means no tear from distance
		this.tearDistance = tearDistance;
		
		if (typeof restingDistance === "undefined" || (restingDistance!==0 && !restingDistance)) {
			this.restingDistance = this.p1.position.distance(this.p2.position);
		} else {
			
			this.restingDistance = restingDistance;
		}
	},

	solve: function() {
		//distance formula
		var p1vec = this.p1.position;
		var p2vec = this.p2.position;

		var dx = p1vec.x - p2vec.x;
		var dy = p1vec.y - p2vec.y;
		var dz = p1vec.z - p2vec.z;
		var d = Math.sqrt(dx * dx + dy * dy + dz * dz);

		//tear the constraint 
		if (this.tearDistance && d > this.tearDistance) {
			this.p1.removeConstraint(this);
		}
		
		//ratio for resting distance
		var restingRatio = d===0 ? this.restingDistance : (this.restingDistance - d) / d;
		
		//invert mass quantities
		var im1 = 1.0 / this.p1.mass;
		var im2 = 1.0 / this.p2.mass;
		var scalarP1 = (im1 / (im1 + im2)) * this.stiffness;
		var scalarP2 = this.stiffness - scalarP1;
		
		//push/pull based on mass
		p1vec.x += dx * scalarP1 * restingRatio;
		p1vec.y += dy * scalarP1 * restingRatio;
		p1vec.z += dz * scalarP1 * restingRatio;

		p2vec.x -= dx * scalarP2 * restingRatio;
		p2vec.y -= dy * scalarP2 * restingRatio;
		p2vec.z -= dz * scalarP2 * restingRatio;
	}

});

module.exports = Constraint;
},{"klasse":37}],34:[function(require,module,exports){
var Class = require('klasse');
var Vector3 = require('vecmath').Vector3;
var Constraint = require('./Constraint');

var PointMass = new Class({
	initialize: function (x, y, z, mass) {
		this.position = new Vector3(x, y, z);
		this.lastPosition = new Vector3(x, y, z);
		this.acceleration = new Vector3(0.0, 0.0, 0.0);
		
		/** Changing this doesn't do anything. 
		This is only included so you can do something with the velocity. */
		this.velocity = new Vector3(0, 0, 0);

		this.pinPosition = null;
		this.pinned = false;
		this.isWeakPin = false;
		this.mass = mass || 1.0;
		
		this.constraints = [];
	},
	
	addForce: function(vec) {
		// acceleration = force / mass
		var a = this.acceleration; //vector components
		a.x += vec.x / this.mass;
		a.y += vec.y / this.mass;
		a.z += vec.z / this.mass;
	},
	
	attach: function(point, restingDistance, stiffness, tearDistance) {
		var c = new Constraint(this, point, restingDistance, stiffness, tearDistance);
		this.addConstraint(c);
		return c;
	},
	
	addConstraint: function(constraint) {
		this.constraints.push(constraint);  
	},
	
	removeConstraint: function(constraint) {
		var i = this.constraints.length;
		while (i--) {
			if (this.constraints[i] === constraint)
				this.constraints.splice(i, 1);
		}
	},
	
	pin: function(x, y, z, weak) {
		if (this.pinPosition === null)
			this.pinPosition = new Vector3();
		this.pinPosition.x = x;
		this.pinPosition.y = y;
		this.pinPosition.z = z;
		this.pinned = true;
		this.isWeakPin = !!weak;
	},
	
	unpin: function() {
		this.pinned = false;   
		this.isWeakPin = false;
	},
	
	solveConstraints: function(world) {
		//solve each constraint
		for (var i=0; i<this.constraints.length; i++) 
			this.constraints[i].solve();
		
		//force the constraint within the bounds of our window
		// if (world.bounds !== null) {
		// 	var bx = world.bounds.x + 1;
		// 	var by = world.bounds.y + 1;
		// 	var bw = world.bounds.width - 1;
		// 	var bh = world.bounds.height - 1;
			
		// 	var pvec = this.position;
		// 	var px = this.position.x;
		// 	var py = this.position.y;

		// 	if (py < by)
		// 		pvec.y = 2 * by - py;
		// 	if (py > bh)
		// 		pvec.y = 2 * bh - py;
		// 	if (px < bx)
		// 		pvec.x = 2 * bx - px;
		// 	if (px > bw)
		// 		pvec.x = 2 * bw - px;
		// }
		
		//TODO: solve before pinning?
//            if (this.pinned && this.pinPosition !== null) {
//                this.position.x = this.pinPosition.x;
//                this.position.y = this.pinPosition.y;
//            }
	}
});

module.exports = PointMass;
},{"./Constraint":33,"klasse":37,"vecmath":47}],35:[function(require,module,exports){
var Class = require('klasse');
var Vector3 = require('vecmath').Vector3;
var Vector2 = require('vecmath').Vector2;

var PointMass = require('./PointMass');
var Constraint = require('./Constraint');

var distSq = require('minimath').distanceSq;

var World = new Class({

	initialize: function(gravity) {
		this.gravity = gravity || new Vector3(0, 1200, 0);
		this.friction = 0.99;
		this.bounds = null;
		this.accuracy = 2;
		this.points = [];
		
		this.move = new PointMass(0,0,0);
		this.tear = new PointMass(0,0,0);
		this.tearInfluenceSq = 0;
		this.moveInfluenceSq = 0;

		this.tear3D = false;
		
		this._pinRemoveInfluenceSq = 0;
		this.moveScalar = 1.8; 
		this.maxMoveSq = 0.0;
		
		this.obstacles = [];
		
		this.groundFriction = 1.0;
		this.floor = null;
		this.bounds = null;
	},

	setPinRemoveInfluence: function(influence) {
		this._pinRemoveInfluenceSq = influence * influence;
	},
	
	/** Adds a single point mass to the world. */
	addPoint: function(pointMass) {
		this.points.push(pointMass);
	},
	
	/** Adds an array of point masses. */
	addPoints: function(pointsArray) {
		for (var i=0; i<pointsArray.length; i++) {
			this.points.push(pointsArray[i]);
		}
	},
	
	applyMotion: function(x, y, z, influence, scalar, maxDist) {
		this.moveInfluenceSq = influence * influence;
		this.moveScalar = scalar || 1.8;

		var mov = this.move.position;
		mov.x = x;
		mov.y = y;
		mov.z = z;
		
		if (maxDist === 0) {
			this.maxMoveSq = 0;
		} else {
			maxDist = +(maxDist || 100.0);
			this.maxMoveSq = maxDist * maxDist;
		}
	},
	
	applyTear: function(x, y, z, influence) {
		this.tearInfluenceSq = influence * influence;
		var tpos = this.tear.position;
		tpos.x = x;
		tpos.y = y;
		tpos.z = z;
	}, 

	_handleInteractions: function() {
		if (this.moveInfluenceSq!==0 || this.tearInfluenceSq!==0) {
			//interactions
			for (var i=0; i<this.points.length; i++) {
				var p = this.points[i];
				var movePos = this.move.position;
				var tearPos = this.tear.position;
				var otherPos = p.position;
				var mvec = movePos;
				var tvec = tearPos;
				var ovec = otherPos;

				var moveDistSq, tearDistSq;
				if (this.tear3D) {
					moveDistSq = mvec.distSq(ovec);
					tearDistSq = tvec.distSq(ovec);
				} else {
					moveDistSq = distSq(mvec.x, mvec.y, ovec.x, ovec.y);
					tearDistSq = distSq(tvec.x, tvec.y, ovec.x, ovec.y);
				}

					

				if (this.moveInfluenceSq!==0 && moveDistSq < this.moveInfluenceSq) {
					//new and old positions
					var op = this.move.lastPosition;
					
					var mAmtX = (mvec.x - op.x);
					var mAmtY = (mvec.y - op.y);
					var mAmtZ = (mvec.z - op.z);

					var max = 0;
					var lenSq = mAmtX*mAmtX + mAmtY*mAmtY + mAmtZ*mAmtZ;
					if (this.maxMoveSq === 0 || lenSq < this.maxMoveSq) {
						mAmtX *= this.moveScalar;
						mAmtY *= this.moveScalar;
						mAmtZ *= this.moveScalar;
						p.lastPosition.x = p.position.x - mAmtX;
						p.lastPosition.y = p.position.y - mAmtY;
						p.lastPosition.z = p.position.z - mAmtZ;
						
						if (p.isWeakPin) {
							p.unpin();
						}
					}
				} else if (this._pinRemoveInfluenceSq!==0 && moveDistSq < this._pinRemoveInfluenceSq) {
					if (p.isWeakPin)
						p.unpin();
				}
				if (this.tearInfluenceSq!==0 && tearDistSq < this.tearInfluenceSq) {
					p.constraints = [];
				}
			}
		}
	},

	_solveConstraints: function() {
		//given the degree of accuracy, we'll solve our constraints here...
		var i = this.accuracy;
		while (i--) {
			for (var j=0; j<this.points.length; j++) {
				this.points[j].solveConstraints(this);
			}
		}
	},

	_integrate: function(delta) {
		//now update with verlet integration
		for (var i=0; i<this.points.length; i++) {
			var p = this.points[i];
			
			//add world gravity
			p.addForce(this.gravity);

			var posvec = p.position;
			var lastvec = p.lastPosition;
			var accelvec = p.acceleration;

			//difference in positions
			var vx = posvec.x - lastvec.x;
			var vy = posvec.y - lastvec.y;
			var vz = posvec.z - lastvec.z;

			//dampen velocity
			vx *= this.friction;
			vy *= this.friction;
			vz *= this.friction;

			p.velocity.x = vx;
			p.velocity.y = vy;
			p.velocity.z = vz;

			//len2
			var len2 = vx * vx + vy * vy + vz * vz;
			
			if (this.floor!==null && p.position.y >= this.floor && len2 > 0.000001) {
				var m = Math.sqrt(len2);
				if (m!=0) {
					vx /= m;
					vy /= m;
				}
				vx *= m*this.groundFriction;
				vy *= m*this.groundFriction;
			}
			
			var tSqr = delta * delta;
			
			//verlet integration
			var nx = posvec.x + vx + 0.5 * accelvec.x * tSqr;
			var ny = posvec.y + vy + 0.5 * accelvec.y * tSqr;
			var nz = posvec.z + vz + 0.5 * accelvec.z * tSqr;

			//set last position & new position
			lastvec.x = posvec.x;
			lastvec.y = posvec.y;
			lastvec.z = posvec.z;

			posvec.x = nx;
			posvec.y = ny;
			posvec.z = nz;

			//reset acceleration
			accelvec.x = 0;
			accelvec.y = 0;
			accelvec.z = 0;
		}
	},

	_setPins: function() {
		for (var i=0; i<this.points.length; i++) {
			var p = this.points[i];
			if (p.pinned && p.pinPosition !== null) {
				p.position.x = p.pinPosition.x;
				p.position.y = p.pinPosition.y;
				p.position.z = p.pinPosition.z;
			}   
		}
	},

	step: function(delta) {		
		//use small methods in the hopes that V8 optimizes them a bit better
		this._solveConstraints();
		this._handleInteractions();
		this._integrate(delta);
		this._setPins();
		
		this.move.lastPosition.x = this.move.position.x;
		this.move.lastPosition.y = this.move.position.y;
		this.move.lastPosition.z = this.move.position.z;
		
		this.tear.lastPosition.x = this.tear.position.x;
		this.tear.lastPosition.y = this.tear.position.y;
		this.tear.lastPosition.z = this.tear.position.z;
		
		this.moveInfluenceSq = this.tearInfluenceSq = 0;
	}
});

module.exports = World;
},{"./Constraint":33,"./PointMass":34,"klasse":37,"minimath":39,"vecmath":47}],36:[function(require,module,exports){
module.exports = {
	World: require('./World'),
	Constraint: require('./Constraint'),
	PointMass: require('./PointMass'),
};
},{"./Constraint":33,"./PointMass":34,"./World":35}],37:[function(require,module,exports){
module.exports=require(23)
},{}],38:[function(require,module,exports){
var Rectangle = function(x, y, width, height) {
	this.x = x || 0;
	this.y = y || 0;
	this.width = width || 0;
	this.height = height || 0;
};

Rectangle.prototype.constructor = Rectangle;

//TODO: this is going to get removed from minimath

module.exports = Rectangle;
},{}],39:[function(require,module,exports){
var distanceSq = function(x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    return dx * dx + dy * dy;
};



module.exports = {
	
	/**
	 * Random number between two values.  
	 */
    random: function(start, end) {
        return start + Math.random() * (end - start);   
    },
    
    /** Utility function for linear interpolation. */
    lerp: function(v0, v1, t) {
        return v0*(1-t)+v1*t;
    },
    
    /** Utility function for Hermite interpolation. */
    smoothstep: function(v0, v1, t) {
        // Scale, bias and saturate x to 0..1 range
        t = Math.max(0.0, Math.min(1.0, (t - v0)/(v1 - v0) ));
        // Evaluate polynomial
        return t*t*(3 - 2*t);
    },
    
    /** pythagorean, squared */
    distanceSq: distanceSq,

    /** pythagorean */
    distance: function(x1, y1, x2, y2) {
        return Math.sqrt( distanceSq(x1, y1, x2, y2) );
    },

    /** Utility function to shuffle an array in place 
    (Fisher-Yates). */
    shuffle: function(array) {
        var counter = array.length, temp, index;
    
        // While there are elements in the array
        while (counter--) {
            // Pick a random index
            index = (Math.random() * counter) | 0;
    
            // And swap the last element with it
            temp = array[counter];
            array[counter] = array[index];
            array[index] = temp;
        }
    
        return array;
    },

    Rectangle: require('./Rectangle')
};
},{"./Rectangle":38}],40:[function(require,module,exports){
module.exports=require(25)
},{}],41:[function(require,module,exports){
module.exports=require(26)
},{}],42:[function(require,module,exports){
module.exports=require(27)
},{"./Matrix3":40,"./Vector3":44,"./common":46}],43:[function(require,module,exports){
module.exports=require(28)
},{}],44:[function(require,module,exports){
module.exports=require(29)
},{}],45:[function(require,module,exports){
module.exports=require(30)
},{"./common":46}],46:[function(require,module,exports){
module.exports=require(31)
},{}],47:[function(require,module,exports){
arguments[4][32][0].apply(exports,arguments)
},{"./Matrix3":40,"./Matrix4":41,"./Quaternion":42,"./Vector2":43,"./Vector3":44,"./Vector4":45}],48:[function(require,module,exports){


var Vector3 = require('vecmath').Vector3;
var World = require('verlet3d').World;
var Constraint = require('verlet3d').Constraint;
var PointMass = require('verlet3d').PointMass;

var Cloth = require('./lib/Cloth');
var ClothRenderer = require('./lib/ClothRenderer');

var WebGLContext = require('kami').WebGLContext;
var ShaderProgram = require('kami').ShaderProgram;
var Texture = require('kami').Texture;

var domready = require('domready');
var raf = require('raf.js');

var fs = require('fs');

var vert = "attribute vec4 Position;\nattribute vec4 Color;\nattribute vec3 Normal;\nattribute vec2 TexCoord0;\n\nuniform mat4 u_projModelView;\nuniform float time;\n\nvarying vec4 v_col;\nvarying vec2 v_texCoord0;\nvarying vec3 v_normal;\n\nuniform mat3 rot;\n\nvoid main() {\n\tgl_Position = u_projModelView * vec4(Position.xy, 0.0, 1.0);\n\n\tv_col = Color;\n\tv_normal = Normal;\n\tv_texCoord0 = TexCoord0;\n}";
var frag = "#ifdef GL_ES\nprecision mediump float;\n#endif\nvarying vec4 v_col;\nvarying vec3 v_normal;\nvarying vec2 v_texCoord0;\n\nuniform sampler2D u_sampler0;\nuniform sampler2D u_sampler1;\n\n//values used for shading algorithm...\nuniform vec2 Resolution;      //resolution of screen\nuniform vec3 LightPos;        //light position, normalized\nuniform vec4 LightColor;      //light RGBA -- alpha is intensity\nuniform vec4 AmbientColor;    //ambient RGBA -- alpha is intensity \nuniform vec3 Falloff;         //attenuation coefficients\n\nvoid main() {\n    //this could easily be an image ... \n\tvec4 diffuseColor = v_col; //* texture2D(u_sampler0, v_texCoord0);\n    vec2 check = mod(v_texCoord0.xy * Resolution.xy, vec2(100));\n\n    float noise = texture2D(u_sampler1, v_texCoord0 * 3.0).r;\n\n    if (check.x < 50.0)\n        diffuseColor = vec4(0.2,0.3,0.5,1.0);\n    \n    diffuseColor += noise * 0.2;\n\n    //The delta position of light\n    vec3 LightDir = vec3(LightPos.xy - (gl_FragCoord.xy / Resolution.xy), LightPos.z);\n\n    //Correct for aspect ratio\n    LightDir.x *= Resolution.x / Resolution.y;\n\n    //Determine distance (used for attenuation) BEFORE we normalize our LightDir\n    float D = length(LightDir);\n\n    // diffuseColor.r = smoothstep(0.5, 0.55, D);\n\n    //normalize our vectors\n    vec3 N = normalize(v_normal);\n    vec3 L = normalize(LightDir);\n\n    //Pre-multiply light color with intensity\n    //Then perform \"N dot L\" to determine our Diffuse term\n    vec3 Diffuse = (LightColor.rgb * LightColor.a) * max(dot(N, L), 0.0);\n\n\n    //pre-multiply ambient color with intensity\n    vec3 Ambient = AmbientColor.rgb * AmbientColor.a;\n\n    //calculate attenuation\n    float Attenuation = 1.0 / ( Falloff.x + (Falloff.y*D) + (Falloff.z*D*D) );\n    // float Attenuation = D;\n\n    //the calculation which brings it all together\n    vec3 Intensity = Ambient + Diffuse * Attenuation;\n    vec3 FinalColor = diffuseColor.rgb * Intensity;\n    gl_FragColor = v_col * vec4(FinalColor, diffuseColor.a);\n    // gl_FragColor = vec4(vec3(v_texCoord0.x), 1.0);\n}";

domready(function() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    var canvas = document.createElement("canvas");
    document.body.style.margin = "0";
    document.body.style.background = "black";
    document.body.style.overflow = "hidden";
    document.body.appendChild(canvas);


    var context = new WebGLContext(width, height, canvas, {
    	transparent: false,
    	antialias: true
    });


    var mouseInfluence = 15;
    var mouseScale = .25;
    var mouseMaxDist = 20;
    var steps = 60;

    var mouseTearInfluence = 4;
    var gravity = 0;
    var useFloor = false;

    var world = new World(new Vector3(0, 0, 0));
    world.removablePins = true;
    // world.setPinRemoveInfluence(15);

    var cloth = new Cloth(512, 256, { spacing: 8, stiffness: 0.01, });
    world.addPoints(cloth.points);
    
    var mouseDown = false;
    window.addEventListener("mousedown", function(ev) {
    	if (ev.which == 1)
            mouseDown = true;
    });
    window.addEventListener("mouseup", function(ev) {
        if (ev.which == 1)
            mouseDown = false;
    });

    window.addEventListener("keydown", function(ev) {
        if (ev.keyCode === 32) {
            world.points.length = 0;
            cloth.create();
            world.addPoints(cloth.points);
        }
    });

    var texture,
    	renderer,
        noiseTexture;

    var lightZ = .45;


    setupGL();

    function randomNoise() {
        var w = cloth.width,
            h = cloth.height;
        var noise = new Uint8Array(w * h * 4);
        for (var i=0; i<noise.length; i++) {
            noise[i] = Math.floor(Math.random() * 255);
        }

        var noiseTex = new Texture(context, w, h, Texture.Format.RGBA, Texture.DataType.UNSIGNED_BYTE, noise);
        noiseTex.setFilter(Texture.Filter.LINEAR);
        noiseTex.setWrap(Texture.Wrap.REPEAT);
        return noiseTex;
    }

	function setupGL() {
		renderer = new ClothRenderer(context, vert, frag);
		texture = new Texture(context, getURL(), render);
		texture.setFilter(Texture.Filter.LINEAR);
		texture.setWrap(Texture.Wrap.REPEAT);

        noiseTexture = randomNoise();

		renderer.lightPosition.set(0, 0, lightZ);

	}  
    
    function render() {
        requestAnimationFrame(render);
        world.step(0.016);
        
        var gl = context.gl;

        noiseTexture.bind(1);
        texture.bind(0);

        gl.clearColor(0,0,0,1);
        gl.clear(gl.COLOR_BUFFER_BIT);
		
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        renderer.draw(world, cloth.cols, cloth.rows);
    }
    var time = 0;
    window.addEventListener("mousemove", function(ev) {
    	renderer.lightPosition.set(ev.clientX / width, 1 - (ev.clientY/height), lightZ);
    	
    	var z = Math.sin(time += 0.01) * 50;

        if (mouseDown) {
            world.applyTear(ev.clientX, ev.clientY, z, mouseTearInfluence);
            world.applyMotion(ev.clientX, ev.clientY, z, mouseInfluence, mouseScale, mouseMaxDist);
        } else
            world.applyMotion(ev.clientX, ev.clientY, z, mouseInfluence, mouseScale, mouseMaxDist);
    });

    function getURL() {
        return "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
    }
});
},{"./lib/Cloth":1,"./lib/ClothRenderer":2,"domready":8,"fs":49,"kami":20,"raf.js":24,"vecmath":32,"verlet3d":36}],49:[function(require,module,exports){

},{}]},{},[48])