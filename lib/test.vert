attribute vec4 Position;
attribute vec4 Color;
attribute vec3 Normal;

uniform mat4 u_projModelView;
uniform float time;

varying vec4 v_col;
varying vec3 v_normal;

uniform mat3 rot;

void main() {
	//animated particle on GPU !
	vec2 pos = vec2(Position.xy);
	vec2 dir = pos - Normal.xy;

	gl_Position = u_projModelView * vec4(Position.xy, 0.0, 1.0);

	v_col = Color;
	v_normal = Normal;
}