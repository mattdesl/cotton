#ifdef GL_ES
precision mediump float;
#endif
varying vec4 v_col;
varying vec3 v_normal;
varying vec2 v_texCoord0;

uniform sampler2D u_sampler0;
uniform sampler2D u_sampler1;

//values used for shading algorithm...
uniform vec2 Resolution;      //resolution of screen
uniform vec3 LightPos;        //light position, normalized
uniform vec4 LightColor;      //light RGBA -- alpha is intensity
uniform vec4 AmbientColor;    //ambient RGBA -- alpha is intensity 
uniform vec3 Falloff;         //attenuation coefficients

void main() {
    //this could easily be an image ... 
	vec4 diffuseColor = v_col; //* texture2D(u_sampler0, v_texCoord0);
    vec2 check = mod(v_texCoord0.xy * Resolution.xy, vec2(100));

    float noise = texture2D(u_sampler1, v_texCoord0 * 3.0).r;

    if (check.x < 50.0)
        diffuseColor = vec4(0.2,0.3,0.5,1.0);
    
    diffuseColor += noise * 0.2;

    //The delta position of light
    vec3 LightDir = vec3(LightPos.xy - (gl_FragCoord.xy / Resolution.xy), LightPos.z);

    //Correct for aspect ratio
    LightDir.x *= Resolution.x / Resolution.y;

    //Determine distance (used for attenuation) BEFORE we normalize our LightDir
    float D = length(LightDir);

    // diffuseColor.r = smoothstep(0.5, 0.55, D);

    //normalize our vectors
    vec3 N = normalize(v_normal);
    vec3 L = normalize(LightDir);

    //Pre-multiply light color with intensity
    //Then perform "N dot L" to determine our Diffuse term
    vec3 Diffuse = (LightColor.rgb * LightColor.a) * max(dot(N, L), 0.0);


    //pre-multiply ambient color with intensity
    vec3 Ambient = AmbientColor.rgb * AmbientColor.a;

    //calculate attenuation
    float Attenuation = 1.0 / ( Falloff.x + (Falloff.y*D) + (Falloff.z*D*D) );
    // float Attenuation = D;

    //the calculation which brings it all together
    vec3 Intensity = Ambient + Diffuse * Attenuation;
    vec3 FinalColor = diffuseColor.rgb * Intensity;
    gl_FragColor = v_col * vec4(FinalColor, diffuseColor.a);
    // gl_FragColor = vec4(vec3(v_texCoord0.x), 1.0);
}