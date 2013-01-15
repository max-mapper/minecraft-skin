var cw = 400, ch = 550;
var camera = new THREE.PerspectiveCamera(35, cw / ch, 1, 1000);
camera.position.z = 50;
var scene = new THREE.Scene();
scene.add(camera)
var renderer = new THREE.WebGLRenderer({
  antialias: true
})
renderer.setSize(cw, ch)
renderer.setClearColorHex(0xBFD1E5, 1.0)
renderer.clear()
var threecanvas = renderer.domElement;
document.body.appendChild(threecanvas);
var ambientLight, directionalLight
ambientLight = new THREE.AmbientLight(0xaaaaaa)
scene.add(ambientLight)
var light	= new THREE.DirectionalLight( 0xffffff )
light.position.set( Math.random(), Math.random(), Math.random() ).normalize()
scene.add( light )
camera.lookAt(new THREE.Vector3(0, 0, 0))
scene.add(camera)

var mouseX = 0;
var mouseY = 0.1;
var originMouseX = 0;
var originMouseY = 0;

var rad = 0;

var isMouseOver = false;
var isMouseDown = false;

var counter = 0;
var firstRender = true;

var startTime = Date.now();
var pausedTime = 0;
var isRotating = true;
var isPaused = false;
var isYfreezed = false;
var isFunnyRunning = false;

var render = function () {
	window.webkitRequestAnimationFrame(render, renderer.domElement);
	var oldRad = rad;
	
	var time = (Date.now() - startTime)/1000;
	
	if(!isMouseDown) {
		//mouseX*=0.95;
		if(!isYfreezed) {
			mouseY*=0.97;
		}
		if(isRotating) {
			rad += 2;
		}
	}
	else {
		rad = mouseX;
	}
	if(mouseY > 500) {
		mouseY = 500;
	}
	else if(mouseY < -500) {
		mouseY = -500;
	}
	camera.position.x = -Math.cos(rad/(cw/2)+(Math.PI/0.9));
	camera.position.z = -Math.sin(rad/(cw/2)+(Math.PI/0.9));
	camera.position.y = (mouseY/(ch/2))*1.5+0.2;
	camera.position.setLength(70);
	camera.lookAt(new THREE.Vector3(0, 1.5, 0));
		
	renderer.render(scene, camera);
};

render()
var skin = require('./')
var viking = skin(THREE, 'viking.png')
scene.add(viking.createPlayerObject())