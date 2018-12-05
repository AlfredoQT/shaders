
let canvas = document.getElementById("webgl-canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let app = PicoGL.createApp(canvas);

//let spector = new SPECTOR.Spector();
//spector.displayUI();

// -----------------------------------

function fract(x)
{
    return x - Math.floor(x);
}

function dot2(x0,y0,x1,y1)
{
    return x0*x1 + y0*y1;
}

function hash( x, y )  // replace this by something better
{
    const kx = 0.3183099; const ky = 0.3678794;
    x = x * kx + ky;
    y = y * ky + kx;

    const t = fract( x * y * (x + y) );
    return [-1.0 + 2.0 * fract( 16.0 * kx * t ), -1.0 + 2.0 * fract( 16.0 * ky * t )];
}

function noise( x, y )
{
    const ix = Math.floor( x ); const iy = Math.floor( y );
    const fx = fract( x ); const fy = fract( y );
    const ux = fx * fx * (3.0-2.0*fx); const uy = fy * fy * (3.0-2.0*fy);

    const h0 = hash( ix, iy );
    const d0 = dot2( h0[0], h0[1], fx, fy );
    const h1 = hash( ix + 1.0, iy );
    const d1 = dot2( h1[0], h1[1], fx - 1.0, fy );
    const h2 = hash( ix, iy + 1.0 );
    const d2 = dot2( h2[0], h2[1], fx, fy - 1.0 );
    const h3 = hash( ix + 1.0, iy + 1.0 );
    const d3 = dot2( h3[0], h3[1], fx - 1.0, fy - 1.0 );

    const m0 = d1 * ux + d0 * (1.0 - ux);
    const m1 = d3 * ux + d2 * (1.0 - ux);
    return m1 * uy + m0 * (1.0 - uy);
}

function noiseUV( uvx, uvy, scale )
{
    uvx *= scale; uvy *= scale;
    
    let f = 0.5 * noise( uvx, uvy ); 
    let uvx2 = uvx * 1.6 + uvy * 1.2;
    let uvy2 = uvx * -1.2 + uvy * 1.6;
    f += 0.2500 * noise( uvx2, uvy2 );
    uvx = uvx2 * 1.6 + uvy2 * 1.2;
    uvy = uvx2 * -1.2 + uvy2 * 1.6;
    f += 0.1250 * noise( uvx, uvy );
    uvx2 = uvx * 1.6 + uvy * 1.2;
    uvy2 = uvx * -1.2 + uvy * 1.6;
    f += 0.0625 * noise( uvx2, uvy2 );
    return f;
}

// -----------------------------------

const planeSubdivisions = 50;

let meshVertices = new Float32Array( planeSubdivisions * planeSubdivisions * 3 );
let meshAttrib0 = new Float32Array( planeSubdivisions * planeSubdivisions * 3 );
{
    let idx = 0;
    for( let y=0; y<planeSubdivisions; y++ )
        for( let x=0; x<planeSubdivisions; x++ )
        {
            const vx = ( x / ( planeSubdivisions - 1 ) ) * 2.0 - 1.0;
            const vy = ( y / ( planeSubdivisions - 1 ) ) * 2.0 - 1.0;

            meshVertices[idx+0] = vx;
            meshVertices[idx+1] = vy;
            meshVertices[idx+2] = 0.0;
            
            meshAttrib0[idx + 0] = noiseUV( vx * 0.5 + 0.5, vy * 0.5 + 0.5, 8.0 );
            meshAttrib0[idx + 1] = noiseUV( vx * 0.5 + 0.5, vy * 0.5 + 0.5, 4.0 );
            meshAttrib0[idx + 2] = noiseUV( vx * 0.5 + 0.5, vy * 0.5 + 0.5, 2.0 );


            idx+=3;
        }
}

let meshIndices = new Uint16Array( (planeSubdivisions - 1) * (planeSubdivisions - 1) * 2 * 3 );
{
    const numQuads = planeSubdivisions - 1;
    let idx = 0;
    for( let y=0; y<numQuads; y++ )
        for( let x=0; x<numQuads; x++ )
        {
            const i = y * planeSubdivisions + x;

            meshIndices[idx++] = i; meshIndices[idx++] = i + planeSubdivisions; meshIndices[idx++] = i + 1;
            meshIndices[idx++] = i + 1; meshIndices[idx++] = i + planeSubdivisions; meshIndices[idx++] = i + planeSubdivisions + 1;
        }
}

let vertexArray;
{
    const positions = app.createVertexBuffer( PicoGL.FLOAT, 3, meshVertices );
    const attrib0 = app.createVertexBuffer( PicoGL.FLOAT, 3, meshAttrib0 );
    const indices = app.createIndexBuffer( PicoGL.UNSIGNED_SHORT, 3, meshIndices );
    vertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, positions)
    .vertexAttributeBuffer(1, attrib0)
    .indexBuffer(indices); 
}

let shaders;
{
    const sharedShaderSource = document.getElementById("test_shared").text.trim();
    const vertexShaderSource = document.getElementById("test_vs").text.trim();
    const fragmentShaderSource = document.getElementById("test_fs").text.trim();
    shaders = app.createProgram( sharedShaderSource+vertexShaderSource, sharedShaderSource+fragmentShaderSource );
}

const uniformBuffer = app.createUniformBuffer([ PicoGL.FLOAT_MAT4, PicoGL.FLOAT_MAT4, PicoGL.FLOAT_MAT4, PicoGL.FLOAT, PicoGL.FLOAT ]);

const drawObject = app.createDrawCall( shaders, vertexArray )
    .uniformBlock("ShaderGlobals", uniformBuffer );

// -----------------------------------

const projMat = mat4.create();
mat4.perspective(projMat, Math.PI / 2, canvas.width / canvas.height, 0.1, 100.0);

const viewMat = mat4.create();
{
    const eyePosition = vec3.fromValues(5, 10, -2);
    const lookAtPos = vec3.fromValues(0, 0, 0);
    const lookUpVec = vec3.fromValues(0, 1, 0);
    mat4.lookAt(viewMat, eyePosition, lookAtPos, lookUpVec);
}

let modelMat = mat4.create(); // create by default makes an identity matrix

uniformBuffer.set(0, modelMat);
uniformBuffer.set(1, viewMat);
uniformBuffer.set(2, projMat);

// -----------------------------------

let time = 0.0;
let fxStartTime = 0.0;
const fxSpeed = 0.2;

app.drawBackfaces(); // app.cullBackfaces();
app.depthTest();
app.clearColor(0.1, 0.1, 0.1, 1.0);

class CircleComponent {
    constructor() {
        const u = Math.random();
        const v = Math.random();
        const angle1 = 2 * Math.PI * u;
        const angle2 = Math.acos(2.0 * v - 1.0);
        this.X = Math.sin(angle1) * Math.cos(angle2);
        this.Y = Math.sin(angle1) * Math.sin(angle1);
        this.Z = Math.cos(angle1);
        this.SCALE = Math.random() * 0.5 + 0.5;
        this.INITIAL_ROTATION = Math.random() * 2.0 * Math.PI;
        this.FX_START_TIME = Math.random(); // Just a random;
        this.FX_SPEED = Math.random() * (1.0 - 0.4) + 0.4;
        this.INITIAL_SCALE_OFFSET = Math.random() * Math.PI * 2;
    }
}

const N_INSTANCES = 300;
let circleComponents = [];
for (let index = 0; index < N_INSTANCES; index++) {
    circleComponents.push(new CircleComponent());
    
}

const radius = 5;
function frameDraw() 
{
    time = window.performance.now() * 0.001; // https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
    app.clear();

    uniformBuffer.set(3, time); // update the first slot, the float (iTime)    
    
    for (let index = 0; index < N_INSTANCES; ++index)
    {
        const circleComponent = circleComponents[index];
        const newModelMat = mat4.create();
        // // Determine how much to rotate the object
        // const rotationAmount = (Math.PI * 2) * (index / numObjects);
        // const initialRotation = Math.random() * 2.0 * Math.PI; Oops!

        let fxTime = (time - circleComponent.FX_START_TIME) * circleComponent.FX_SPEED;
        uniformBuffer.set(4, fxTime);

        // Then rotate it based on the rotation properties of the instance
        mat4.rotate(
            newModelMat,
            newModelMat,
            time * circleComponent.FX_SPEED + circleComponent.INITIAL_ROTATION,
            vec3.fromValues(circleComponent.X, circleComponent.Y, circleComponent.Z),
        );
        // Then translate the model in z
        mat4.translate(newModelMat, newModelMat, vec3.fromValues(0, 0, -radius));

        // Just to play around with the scaling, no change in frequnecy
        const scaleFactor = Math.abs(Math.sin(time + circleComponent.INITIAL_SCALE_OFFSET)) * circleComponent.SCALE;
        // First scale each one
        mat4.scale(newModelMat, newModelMat, vec3.fromValues(scaleFactor, scaleFactor, scaleFactor));

        uniformBuffer.set(0, newModelMat);
        uniformBuffer.update(); // this signals that we finished changing values and the buffer can be sent to the GPU
        

        drawObject.draw();    
    }

    
    requestAnimationFrame( frameDraw );
}

requestAnimationFrame( frameDraw );