attribute vec4 Position;
attribute vec4 Color;
attribute vec3 Normal;
attribute vec2 TexCoord0;

uniform mat4 u_projModelView;
uniform float time;

varying vec4 v_col;
varying vec2 v_texCoord0;
varying vec3 v_normal;

uniform mat3 rot;

void main() {
	gl_Position = u_projModelView * vec4(Position.xy, 0.0, 1.0);

	v_col = Color;
	v_normal = Normal;
	v_texCoord0 = TexCoord0;
}