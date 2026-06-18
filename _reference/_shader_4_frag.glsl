#version 300 es
#define varying in
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define gl_FragDepthEXT gl_FragDepth
#define texture2D texture
#define textureCube texture
#define texture2DProj textureProj
#define texture2DLodEXT textureLod
#define texture2DProjLodEXT textureProjLod
#define textureCubeLodEXT textureLod
#define texture2DGradEXT textureGrad
#define texture2DProjGradEXT textureProjGrad
#define textureCubeGradEXT textureGrad
precision highp float;
	precision highp int;
	precision highp sampler2D;
	precision highp samplerCube;
	precision highp sampler3D;
	precision highp sampler2DArray;
	precision highp sampler2DShadow;
	precision highp samplerCubeShadow;
	precision highp sampler2DArrayShadow;
	precision highp isampler2D;
	precision highp isampler3D;
	precision highp isamplerCube;
	precision highp isampler2DArray;
	precision highp usampler2D;
	precision highp usampler3D;
	precision highp usamplerCube;
	precision highp usampler2DArray;
	
#define HIGH_PRECISION
#define SHADER_TYPE ShaderMaterial
#define SHADER_NAME 
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;
#define OPAQUE
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 linearToOutputTexel( vec4 value ) {
	return LinearTransferOETF( vec4( value.rgb * mat3( 1.0000,-0.0000,-0.0000,-0.0000,1.0000,0.0000,0.0000,0.0000,1.0000 ), value.a ) );
}
float luminance( const in vec3 rgb ) {
	const vec3 weights = vec3( 0.2126, 0.7152, 0.0722 );
	return dot( weights, rgb );
}


                precision highp float;
                uniform sampler2D uPosition;
                uniform sampler2D uPosRefs;
                uniform sampler2D uPosNearest;

                uniform vec2 uMousePos;
                uniform float uTime;
                uniform float uDeltaTime;
                uniform float uIsHovering;

                vec2 hash( vec2 p ){
                    p = vec2( dot(p,vec2(2127.1,81.17)), dot(p,vec2(1269.5,283.37)) );
                    return fract(sin(p)*43758.5453);
                }

                void main() {

                    vec2 simTexCoords = gl_FragCoord.xy / vec2(256.0, 256.0);
                    vec4 pFrame = texture2D(uPosition, simTexCoords);

                    float scale = pFrame.z;
                    float velocity = pFrame.w;
                    vec2 refPos = texture2D(uPosRefs, simTexCoords).xy;
                    vec2 nearestPos = texture2D(uPosNearest, simTexCoords).xy;
                    float seed = hash(simTexCoords).x;
                    float seed2 = hash(simTexCoords).y;

                    float time = uTime * .5;
                    float lifeEnd = 3. + sin(seed2 * 100.) * 1.;
                    float lifeTime = mod((seed * 100.) + time, lifeEnd);

                    vec2 disp = vec2(0., 0.);
                    vec2 pos = pFrame.xy;

                    float distRadius = 0.15;

                    vec2 targetPos = refPos;
                    targetPos = mix(targetPos, nearestPos, uIsHovering * uIsHovering);

                    vec2 direction = normalize(targetPos - pos);
                    direction *= .01;

                    float dist = length(targetPos - pos);
                    float distStrength = smoothstep(distRadius, 0., dist);

                    if(dist > 0.005){
                        pos += direction * distStrength;
                    }

                    if(lifeTime < .01){
                        pos = refPos;
                        pFrame.xy = refPos;
                        scale = 0.;
                    }

                    // Add scale
                    float targetScale = smoothstep(.01, 0.5, lifeTime) - smoothstep(0.5, 1., lifeTime/lifeEnd);
                    targetScale += smoothstep(0.1, 0., smoothstep(0.001, .1, dist)) * 1.5 * uIsHovering;
                    // targetScale *= distStrength;

                    float scaleDiff = targetScale - scale;
                    scaleDiff *= .1;
                    scale += scaleDiff;

                    // Final position
                    vec2 finalPos = pos + (disp * smoothstep(0.001, distRadius, dist));
                    vec2 diff = finalPos - pFrame.xy;
                    diff *= .2;

                    velocity = smoothstep(distRadius, .001, dist) * uIsHovering;

                    vec4 frame = vec4(pFrame.xy + diff, scale, velocity);

                    gl_FragColor = frame;

                }
            