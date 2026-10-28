var DataDirPath;
var ModelsDirPath;
var TexturesDirPath;

var carColors;

// the scene
var running = false;
var myclump;
var modelinfo;
var camPitch;
var camYaw;
var camDist;
var camTarget = [0, 0, 0];
var activePointers = new Map();
var dragMode = null;
var lastPointer = null;
var lastGesture = null;

// gl things
var state = {};
var whitetex;
var camera;

var envFrame;
var defaultProgram;
var envMapProgram;
var carPS2Program;

var backgroundColor = [25 / 255, 25 / 255, 25 / 255, 1.0];

function deg2rad(d) { return d / 180.0 * Math.PI; }

function
	clampCameraDistance(distance) {
	return Math.max(0.5, Math.min(40, distance));
}

function
	zoomCamera(amount) {
	camDist = clampCameraDistance(camDist * Math.exp(amount));
}

function
	panCamera(deltaX, deltaY) {
	const height = gl.canvas.clientHeight;
	if (!height) return;

	const scale = 2 * camDist * Math.tan(deg2rad(70) / 2) / height;
	const right = [-Math.sin(camYaw), Math.cos(camYaw), 0];
	const up = [
		-Math.cos(camYaw) * Math.sin(camPitch),
		-Math.sin(camYaw) * Math.sin(camPitch),
		Math.cos(camPitch)
	];

	for (let i = 0; i < 3; i++)
		camTarget[i] += (-right[i] * deltaX + up[i] * deltaY) * scale;
}

function
	orbitCamera(deltaX, deltaY) {
	camYaw -= deltaX * 2 * Math.PI / gl.canvas.clientWidth;
	camPitch += deltaY * 2 * Math.PI / gl.canvas.clientHeight;
	camPitch = Math.max(-Math.PI / 2 + 0.01,
		Math.min(Math.PI / 2 - 0.01, camPitch));
}

function
	pointerDown(e) {
	if (e.pointerType === "touch") {
		activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		lastGesture = null;
		if (activePointers.size === 1)
			lastPointer = { x: e.clientX, y: e.clientY };
	} else {
		dragMode = e.button === 0 ? "orbit" :
			(e.button === 1 || e.button === 2 ? "pan" : null);
		lastPointer = { x: e.clientX, y: e.clientY };
	}

	if (dragMode || e.pointerType === "touch") {
		e.currentTarget.setPointerCapture(e.pointerId);
		e.preventDefault();
	}
}

function
	pointerMove(e) {
	if (e.pointerType === "touch") {
		if (!activePointers.has(e.pointerId)) return;
		activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

		if (activePointers.size === 1) {
			const point = activePointers.get(e.pointerId);
			if (lastPointer) orbitCamera(point.x - lastPointer.x, point.y - lastPointer.y);
			lastPointer = point;
		} else {
			const points = Array.from(activePointers.values());
			const center = {
				x: (points[0].x + points[1].x) / 2,
				y: (points[0].y + points[1].y) / 2
			};
			const distance = Math.hypot(
				points[1].x - points[0].x,
				points[1].y - points[0].y
			);
			if (lastGesture) {
				panCamera(center.x - lastGesture.center.x, center.y - lastGesture.center.y);
				if (distance > 0 && lastGesture.distance > 0)
					zoomCamera(Math.log(lastGesture.distance / distance));
			}
			lastGesture = { center: center, distance: distance };
		}
		e.preventDefault();
		return;
	}

	if (!dragMode || !lastPointer) return;
	const deltaX = e.clientX - lastPointer.x;
	const deltaY = e.clientY - lastPointer.y;
	if (dragMode === "orbit") orbitCamera(deltaX, deltaY);
	else panCamera(deltaX, deltaY);
	lastPointer = { x: e.clientX, y: e.clientY };
	e.preventDefault();
}

function
	pointerUp(e) {
	if (e.pointerType === "touch") {
		activePointers.delete(e.pointerId);
		lastGesture = null;
		lastPointer = activePointers.size === 1 ?
			Array.from(activePointers.values())[0] : null;
	} else {
		dragMode = null;
		lastPointer = null;
	}
}

function
	InitRW() {
	console.log("InitRW()");
	let canvas = document.querySelector('#glcanvas');

	// Get background color from stylesheet
	const bgColor = window.getComputedStyle(canvas).backgroundColor.match(/[\d.]+/g);
	if (!bgColor || bgColor.length < 3)
		throw new Error("Unable to read the WebGL canvas background color.");
	backgroundColor = bgColor.slice(0, 3).map(function (value) {
		return parseFloat(value) / 255;
	});
	backgroundColor.push(1.0);

	gl = canvas.getContext('webgl');

	if (!gl) {
		showViewerError("Seu navegador ou dispositivo não oferece suporte ao WebGL.");
		return false;
	}

	canvas.addEventListener("pointerdown", pointerDown, false);
	canvas.addEventListener("pointermove", pointerMove, false);
	canvas.addEventListener("pointerup", pointerUp, false);
	canvas.addEventListener("pointercancel", pointerUp, false);
	canvas.addEventListener("wheel", function (e) {
		const delta = e.deltaMode === 1 ? e.deltaY * 16 :
			(e.deltaMode === 2 ? e.deltaY * canvas.clientHeight : e.deltaY);
		zoomCamera(delta * 0.001);
		e.preventDefault();
	}, { passive: false });
	canvas.addEventListener("contextmenu", function (e) {
		e.preventDefault();
	});

	whitetex = loadTexture();

	defaultProgram = loadShaders(defaultVS, defaultFS);
	envMapProgram = loadShaders(envVS, envFS);
	carPS2Program = loadShaders(carPS2VS, carPS2FS);

	state.alphaRef = 0.1;
	state.projectionMatrix = mat4.create();
	state.viewMatrix = mat4.create();
	state.worldMatrix = mat4.create();
	state.envMatrix = mat4.create();
	state.matColor = vec4.create();
	state.surfaceProps = vec4.create();
	state.ambLight = vec3.fromValues(0.8, 0.8, 0.8);
	const alpha = 45;
	const beta = 45;
	state.lightDir = vec3.fromValues(
		-Math.cos(deg2rad(beta)) * Math.cos(deg2rad(alpha)),
		-Math.sin(deg2rad(beta)) * Math.cos(deg2rad(alpha)),
		-Math.sin(deg2rad(alpha))
	);
	state.lightCol = vec3.fromValues(1.0, 1.0, 1.0);


	AttachPlugins();

	camera = RwCameraCreate();
	camera.nearPlane = 0.1;
	camera.farPlane = 100.0;
	let frm = RwFrameCreate();
	RwCameraSetFrame(camera, frm);

	const fov = deg2rad(70);
	camera.viewWindow[1] = Math.tan(fov / 2);

	function resizeCanvas() {
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		if (!width || !height) return;

		const pixelRatio = window.devicePixelRatio || 1;
		const bufferWidth = Math.round(width * pixelRatio);
		const bufferHeight = Math.round(height * pixelRatio);
		if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
			canvas.width = bufferWidth;
			canvas.height = bufferHeight;
		}

		gl.viewport(0, 0, canvas.width, canvas.height);
		camera.viewWindow[0] = camera.viewWindow[1] * width / height;
	}

	resizeCanvas();
	new ResizeObserver(resizeCanvas).observe(canvas.parentElement);
	window.addEventListener("resize", resizeCanvas);

	envFrame = RwFrameCreate();
	mat4.rotateX(envFrame.matrix, envFrame.matrix, deg2rad(60));
	rwFrameSynchLTM(envFrame);
	return true;
}

function
	loadCarIII(filename) {
	loadDFF(filename, function (clump) {
		myclump = clump;
		modelinfo = processVehicle(myclump);
		setupIIICar(myclump);
		setVehicleColors(modelinfo, carColors[0], carColors[1]);
		main();
	});
}

function
	loadCarVC(filename) {
	loadDFF(filename, function (clump) {
		myclump = clump;
		modelinfo = processVehicle(myclump);
		setVehicleColors(modelinfo, carColors[0], carColors[1]);
		main();
	});
}

function
	loadCarSA(filename) {
	loadDFF(filename, function (clump) {
		myclump = clump;
		modelinfo = processVehicle(myclump);
		setupSACar(myclump);
		setVehicleColors(modelinfo,
			carColors[0], carColors[1], carColors[2], carColors[3]);
		setVehicleLightColors(modelinfo,
			[255, 255, 255, 255],
			[255, 255, 255, 255],
			[255, 255, 255, 255],
			[255, 255, 255, 255]);
		SAPlateSystem.apply(myclump, filename.replace(/\.dff$/i, ""))
			.then(function () {
				main();
			})
			.catch(function (error) {
				console.error("Não foi possível aplicar a placa do San Andreas:", error);
				main();
			});
	});
}

function
	removeChildren(x) {
	while (x.firstChild)
		x.removeChild(x.firstChild);
}

function
	main() {
	setupPartControls(myclump);

	if (!running) {
		running = true;

		let then = 0;
		function render(now) {
			now *= 0.001;  // convert to seconds
			const deltaTime = now - then;
			then = now;

			drawScene(deltaTime);
			hideViewerLoader();

			requestAnimationFrame(render);
		}
		requestAnimationFrame(render);
	}
}

function
	addPartToggle(container, label, active, onToggle) {
	let button = document.createElement("button");
	button.type = "button";
	button.textContent = label;
	button.setAttribute("aria-pressed", String(active));
	button.classList.toggle("active", active);
	button.onclick = function () {
		active = !active;
		button.setAttribute("aria-pressed", String(active));
		button.classList.toggle("active", active);
		onToggle(active);
	};
	container.appendChild(button);
}

function
	addDamageToggle(container, onToggle) {
		let button = document.createElement("button");
		button.type = "button";
		button.className = "rw-modelview__damage-toggle";
		button.setAttribute("aria-pressed", "false");

		let label = document.createElement("span");
		label.textContent = "Peças danificadas";
		button.appendChild(label);

		let track = document.createElement("span");
		track.className = "rw-modelview__damage-switch";
		track.setAttribute("aria-hidden", "true");
		let thumb = document.createElement("span");
		thumb.className = "rw-modelview__damage-switch-thumb";
		track.appendChild(thumb);
		button.appendChild(track);

		button.onclick = function () {
			let active = button.getAttribute("aria-pressed") !== "true";
			button.setAttribute("aria-pressed", String(active));
			button.classList.toggle("active", active);
			onToggle(active);
		};
		container.appendChild(button);
	}

	function
	setupPartControls(clump) {
	let container = document.getElementById("parts-controls");
	if (!container)
		return;

	removeChildren(container);
	container.hidden = true;

	let damagedByBaseName = new Map();
	let intactByName = new Map();
	let extrasByName = new Map();
	let normalizePartName = function (name) {
		return name.replace(/_(?:dam|dummy|ok)$/, "");
	};

	for (let i = 0; i < clump.atomics.length; i++) {
		let atomic = clump.atomics[i];
		let name = atomic.frame.name.toLowerCase();
		if (name.endsWith("_dam")) {
			let baseName = normalizePartName(name);
			if (!damagedByBaseName.has(baseName))
				damagedByBaseName.set(baseName, []);
			damagedByBaseName.get(baseName).push(atomic);
		}

		if (!name.endsWith("_dam")) {
			let baseName = normalizePartName(name);
			if (!intactByName.has(baseName))
				intactByName.set(baseName, []);
			intactByName.get(baseName).push(atomic);
		}

		if (/^extra\d+$/.test(name)) {
			if (!extrasByName.has(name))
				extrasByName.set(name, []);
			extrasByName.get(name).push(atomic);
		}
	}

	let damagedAtomics = [];
	let intactAtomics = [];
	let intactVisibility = [];
	damagedByBaseName.forEach(function (damagedParts, baseName) {
		damagedAtomics = damagedAtomics.concat(damagedParts);
		let intactParts = intactByName.get(baseName) || [];
		for (let i = 0; i < intactParts.length; i++) {
			intactVisibility.push(intactParts[i].visible);
			intactAtomics.push(intactParts[i]);
		}
	});

	if (damagedAtomics.length > 0) {
		for (let i = 0; i < damagedAtomics.length; i++)
			damagedAtomics[i].visible = false;

		addDamageToggle(container, function (showDamaged) {
			for (let i = 0; i < damagedAtomics.length; i++)
				damagedAtomics[i].visible = showDamaged;
			for (let i = 0; i < intactAtomics.length; i++)
				intactAtomics[i].visible = showDamaged ? false : intactVisibility[i];
		});
	}

	let extraNames = Array.from(extrasByName.keys()).sort(function (a, b) {
		return Number(a.slice(5)) - Number(b.slice(5));
	});
	let selectedExtra = extraNames.length > 0 ?
		extraNames[Math.floor(Math.random() * extraNames.length)] : null;

	extraNames.forEach(function (name) {
		let extraAtomics = extrasByName.get(name);
		let isVisible = name === selectedExtra;
		for (let i = 0; i < extraAtomics.length; i++)
			extraAtomics[i].visible = isVisible;
		addPartToggle(container, "Extra " + name.slice(5), isVisible, function (visible) {
			for (let i = 0; i < extraAtomics.length; i++)
				extraAtomics[i].visible = visible;
		});
	});

	container.hidden = container.childElementCount === 0;
}

function
	setupIIICar(clump) {
	for (let i = 0; i < clump.atomics.length; i++) {
		let a = clump.atomics[i];
		a.pipeline = matFXPipe;
		for (let j = 0; j < a.geometry.materials.length; j++) {
			m = a.geometry.materials[j];
			if (m.surfaceProperties[1] <= 0.0)
				continue;
			m.matfx = {
				type: 2,
				envCoefficient: m.surfaceProperties[1],
				envTex: RwTextureRead("reflection01", "")
			};
		}
	}
}

function
	setupSACar(clump) {
	for (let i = 0; i < clump.atomics.length; i++) {
		let a = clump.atomics[i];
		a.pipeline = carPipe;
		for (let j = 0; j < a.geometry.materials.length; j++) {
			m = a.geometry.materials[j];
			m.fxFlags = 0;
			if (!m.matfx || m.matfx.type != 2) continue;

			if (m.matfx.envTex && m.envMap && m.envMap.shininess != 0) {
				m.envMap.texture = m.matfx.envTex;
				if (m.envMap.texture.name[0] == 'x')
					m.fxFlags |= 2;
				else
					m.fxFlags |= 1;
			}

			if (m.specMap && m.specMap.specularity != 0)
				m.fxFlags |= 4;
		}
	}
}

function
	setVehicleColors(vehinfo, c1, c2, c3, c4) {
	for (let i = 0; i < vehinfo.firstMaterials.length; i++)
		vehinfo.firstMaterials[i].color = c1;
	for (let i = 0; i < vehinfo.secondMaterials.length; i++)
		vehinfo.secondMaterials[i].color = c2;
	for (let i = 0; i < vehinfo.thirdMaterials.length; i++)
		vehinfo.thirdMaterials[i].color = c3;
	for (let i = 0; i < vehinfo.fourthMaterials.length; i++)
		vehinfo.fourthMaterials[i].color = c4;
}

function
	setVehicleLightColors(vehinfo, c1, c2, c3, c4) {
	for (let i = 0; i < vehinfo.firstLightMaterials.length; i++)
		vehinfo.firstLightMaterials[i].color = c1;
	for (let i = 0; i < vehinfo.secondLightMaterials.length; i++)
		vehinfo.secondLightMaterials[i].color = c2;
	for (let i = 0; i < vehinfo.thirdLightMaterials.length; i++)
		vehinfo.thirdLightMaterials[i].color = c3;
	for (let i = 0; i < vehinfo.fourthLightMaterials.length; i++)
		vehinfo.fourthLightMaterials[i].color = c4;
}

function
	findEditableMaterials(geo, vehinfo) {
	for (let i = 0; i < geo.materials.length; i++) {
		m = geo.materials[i];
		if (m.color[0] == 0x3C && m.color[1] == 0xFF && m.color[2] == 0)
			vehinfo.firstMaterials.push(m);
		else if (m.color[0] == 0xFF && m.color[1] == 0 && m.color[2] == 0xAF)
			vehinfo.secondMaterials.push(m);
		else if (m.color[0] == 0 && m.color[1] == 0xFF && m.color[2] == 0xFF)
			vehinfo.thirdMaterials.push(m);
		else if (m.color[0] == 0xFF && m.color[1] == 0x00 && m.color[2] == 0xFF)
			vehinfo.fourthMaterials.push(m);
		else if (m.color[0] == 0xFF && m.color[1] == 0xAF && m.color[2] == 0)
			vehinfo.firstLightMaterials.push(m);
		else if (m.color[0] == 0 && m.color[1] == 0xFF && m.color[2] == 0xC8)
			vehinfo.secondLightMaterials.push(m);
		else if (m.color[0] == 0xB9 && m.color[1] == 0xFF && m.color[2] == 0)
			vehinfo.thirdLightMaterials.push(m);
		else if (m.color[0] == 0xFF && m.color[1] == 0x3C && m.color[2] == 0)
			vehinfo.fourthLightMaterials.push(m);
	}
}

function
	processVehicle(clump) {
	let vehicleInfo = {
		firstMaterials: [],
		secondMaterials: [],
		thirdMaterials: [],
		fourthMaterials: [],
		firstLightMaterials: [],	// front left
		secondLightMaterials: [],	// front right
		thirdLightMaterials: [],	// back left
		fourthLightMaterials: [],	// back right
		clump: clump
	};

	// Wheel atomic to clone
	let wheel = null;

	for (let i = 0; i < clump.atomics.length; i++) {
		a = clump.atomics[i];
		f = a.frame;
		if (f.name.endsWith("_dam") ||
			f.name.endsWith("_lo") ||
			f.name.endsWith("_vlo"))
			a.visible = false;

		if (!wheel && f.name.startsWith("wheel")) {
			wheel = a;
		}

		findEditableMaterials(a.geometry, vehicleInfo);
	}

	// Clone wheels
	let frame = clump.frame.child;
	while (wheel && frame) {
		if (["wheel_rb_dummy", "wheel_rm_dummy", "wheel_lf_dummy", "wheel_lb_dummy", "wheel_lm_dummy"].includes(frame.name)) {
			let wheel2 = RpAtomicClone(wheel);
			mat4.copy(wheel2.frame.ltm, frame.ltm);
			if (["wheel_lf_dummy", "wheel_lb_dummy", "wheel_lm_dummy"].includes(frame.name)) {
				// Rotate cloned wheel
				mat4.rotate(wheel2.frame.ltm, wheel2.frame.ltm, Math.PI, [0, 0, 1]);
			}
			frame.child = wheel2.frame;
			clump.atomics.push(wheel2);
		}
		frame = frame.next;
	}

	return vehicleInfo;
}

function
	drawScene(deltaTime) {
	if (window.autoRotateCamera) {
		camYaw += deltaTime * 0.9;
	}

	gl.clearColor(backgroundColor[0], backgroundColor[1], backgroundColor[2], 1.0);
	gl.clearDepth(1.0);
	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	let x = camTarget[0] + camDist * Math.cos(camYaw) * Math.cos(camPitch);
	let y = camTarget[1] + camDist * Math.sin(camYaw) * Math.cos(camPitch);
	let z = camTarget[2] + camDist * Math.sin(camPitch);
	let cameraUp = Math.abs(Math.cos(camPitch)) < 0.05 ?
		[0.0, 1.0, 0.0] : [0.0, 0.0, 1.0];
	RwFrameLookAt(camera.frame,
		[x, y, z],
		camTarget,
		cameraUp);
	rwFrameSynchLTM(camera.frame);

	RwCameraBeginUpdate(camera);

	RenderPass = 0;
	RpClumpRender(myclump);
	RenderPass = 1;
	RpClumpRender(myclump);
	RenderPass = -1;
}


function
	loadDFF(filename, cb) {
	let req = new XMLHttpRequest();
	req.open("GET", ModelsDirPath + "/" + filename, true);
	req.responseType = "arraybuffer";

	req.onload = function (oEvent) {
		if (req.status < 200 || req.status >= 300) {
			showViewerError(req.status === 404 ?
				"O arquivo do modelo solicitado não está disponível." :
				"Verifique sua conexão e tente recarregar a página.");
			console.error("Falha ao carregar modelo:", req.status, req.responseURL);
			return;
		}

		let arrayBuffer = req.response;
		if (arrayBuffer) {
			stream = RwStreamCreate(arrayBuffer);

			if (RwStreamFindChunk(stream, rwID_CLUMP)) {
				let c = RpClumpStreamRead(stream);
				if (c != null)
					cb(c);
				else {
					showViewerError("O arquivo do modelo está inválido ou incompleto.");
					console.error("O arquivo DFF não contém um modelo válido:", req.responseURL);
				}
			} else {
				showViewerError("O arquivo do modelo está inválido ou incompleto.");
				console.error("O arquivo DFF não contém um clump:", req.responseURL);
			}
			return null;
		}

		showViewerError("O arquivo do modelo veio vazio. Tente recarregar a página.");
	};

	req.onerror = function () {
		showViewerError("Verifique sua conexão e tente recarregar a página.");
		console.error("Falha de rede ao carregar modelo:", req.responseURL);
	};

	req.send(null);
}

function
	rgbToCSSString(r, g, b) {
	return ["rgb(", r, ",", g, ",", b, ")"].join("");
}

function
	RGB2HTML(color) {
	let decColor = 0x1000000 + color[2] + 0x100 * color[1] + 0x10000 * color[0];
	return '#' + decColor.toString(16).substr(1);
}
