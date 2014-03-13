var Class = require('klasse');
var PointMass = require('knit.js').PointMass;

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
        var usePins = true;

        var rows = Math.floor( this.height/spacing );
        var cols = Math.floor( this.width/spacing );
        
        //clear current point list
        points.length = 0;
        for (var y = 0; y <= rows; y++) {
            for (var x = 0; x <= cols; x++) {
                var p = new PointMass(start_x + x * spacing, start_y + y * spacing, mass);

                var edge = !usePins 
                        ? (y === 0)
                        : (y === 0 || x === 0 || y === rows || x === cols);

                if (x!==0)
                    p.attach(points[points.length - 1], spacing, stiff, tear);
                if (edge)
                    p.pin(p.position.x, p.position.y);
                if (y !== 0)
                    p.attach(points[ x + (y - 1) * (cols + 1)], spacing, stiff, tear);

                points.push(p);
            }
        }
    },
});

module.exports = Cloth;