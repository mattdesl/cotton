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

        this.shader = new ShaderProgram(context, vert, frag);
        if (this.shader.log)
            console.warn(this.shader.log);

        this.time = 0;

        this.mesh = new MeshRenderer(context, {
            hasColors: true,
            maxVertices: 150000,
            hasNormals: true,
            numTexCoords: 0
        });

        this.lightPosition = new Vector3();
	},



    resize: function(width, height) {
        // this.camera
    }, 

    draw: function(world) {
        var gl = this.context.gl;
        var r = this.mesh;
        var shader = this.shader;
        var cam = this.camera;

        this.time += 0.1;

        r.shader = shader;
        r.begin(cam.combined, gl.LINES);

        rot.rotate( 0.01 );
        // shader.setUniformMatrix3("rot", rot);
        shader.setUniformf("time", this.time);
        shader.setUniformf("LightPos", this.lightPosition.x, this.lightPosition.y, this.lightPosition.z);
        shader.setUniformf("LightColor", 1, .8, .8, 1);
        shader.setUniformf("AmbientColor", .6, .6, 1, 1);
        shader.setUniformf("Falloff", 0.001, 1, 1);
        shader.setUniformf("Resolution", this.context.width, this.context.height);
        
        // r.color(1,0,0,1);
        // r.texCoord(1, 0);
        // r.vertex(0.0, 128, 0);

        // r.color(0,1,0,1);
        // r.texCoord(0, 0);
        // r.vertex(128, 128, 0);

        // r.color(0.0,0.0,1,0.5);
        // r.texCoord(1, 1);
        // r.vertex(0.0, 0.0, 0);



        for (var i=0; i<world.points.length; i++) {
            var p = world.points[i];

            if (p.constraints.length >= 2) {

                var c = p.constraints;

                var botLeft = c[0].p2;
                var topRight = c[1].p2;

                var a = i/world.points.length; 
                var z = i/world.points.length * Math.sin(this.time * ( (i/400) %20));
                a = .5;

                var scl = 2;
                botLeft.position.z = botLeft.position.y* scl;
                topRight.position.z = topRight.position.y* scl;
                p.position.z = p.position.y* scl;

                this.drawTriangle(botLeft.position, topRight.position, p.position, a, z);

                if (topRight.constraints.length > 0) {
                    c = topRight.constraints;
                    var other = c[0].p2;

                    other.position.z = p.position.y* scl;

                    // this.drawTriangle(other.position, botLeft.position, topRight.position, a, z);
                    this.drawTriangle(botLeft.position, other.position, topRight.position, a, z);
                }
            }
        }

                // this.drawTriangle(new Vector3(), new Vector3(0, 50), new Vector3(50, 50));


        r.end();
    },

    computeNormal: function(a, b, c, z) {
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
        tmpVec3.set(a.x, a.y, 0);
        tmpVec.copy(b).sub( tmpVec3 );

        tmpVec3.set(a.x, a.y, 0);
        tmpVec2.copy(c).sub( tmpVec3 );
        return tmpVec.cross(tmpVec2).normalize();
    },

    drawTriangle: function(p1, p2, p3, a, z) {
        var n = this.computeNormal(p1, p2, p3, z);

        var r = this.mesh;
        r.color(a,a,a,1);
        // r.texCoord(1, 0);
        r.normal(n.x,n.y,n.z);
        r.vertex(p1.x, p1.y, z);

        r.color(a,a,a,1);
        // r.texCoord(0, 0);
        r.normal(n.x,n.y,n.z);
        r.vertex(p2.x, p2.y, z);

        r.color(a,a,a,1);
        // r.texCoord(1, 1);
        r.normal(n.x,n.y,n.z);
        r.vertex(p3.x, p3.y, z);
    },
});

module.exports = ClothRenderer;