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