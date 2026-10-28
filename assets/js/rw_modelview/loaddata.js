var VehicleColours = [];
var ModelInfosName = {};

function
SetCarColors(cols)
{
	carColors = [
		[ 0, 0, 0, 255 ],
		[ 0, 0, 0, 255 ],
		[ 0, 0, 0, 255 ],
		[ 0, 0, 0, 255 ]
	];
	if(cols !== undefined)
		for(let i = 0; i < cols.length; i++){
			// GTA color ID
			let colorID = cols[i];

			// RGB color
			let col = VehicleColours[colorID];
			if(!col) {
				continue;
			}

			carColors[i][0] = col[0];
			carColors[i][1] = col[1];
			carColors[i][2] = col[2];
		}
}

function
LoadColors(cols)
{
	SetCarColors(cols);
	setVehicleColors(modelinfo, carColors[0], carColors[1], carColors[2], carColors[3]);
}

function
SelectModel(model)
{
	let colortable = document.getElementById('colors');
	removeChildren(colortable);

	let currentModel = ModelInfosName[model];
	let uniqueColors = [];
	let seenColorPairs = new Set();
	for (let i = 0; i < currentModel.colors.length; i++) {
		let colors = currentModel.colors[i];
		let firstColor = VehicleColours[colors[0]];
		let secondColor = VehicleColours[colors[1]];
		let colorPair = firstColor.join(",") + "|" + secondColor.join(",");
		if (seenColorPairs.has(colorPair))
			continue;
		seenColorPairs.add(colorPair);
		uniqueColors.push(colors);
	}

	let selectedColorIndex = uniqueColors.length > 0 ?
		Math.floor(Math.random() * uniqueColors.length) : -1;

	for(let i = 0; i < uniqueColors.length; i++){
		let c = uniqueColors[i];
		let colorButton = document.createElement('button');
		colorButton.type = 'button';
		colorButton.className = 'rw-modelview__color-option';
		colorButton.setAttribute('aria-label', 'Combinação de cores ' + (i + 1));
		colorButton.setAttribute('aria-pressed', i === selectedColorIndex ? 'true' : 'false');
		if (i === selectedColorIndex)
			colorButton.classList.add('active');
		let firstColor = VehicleColours[c[0]];
		let secondColor = VehicleColours[c[1]];
		let swatch = document.createElement('span');
		swatch.className = 'rw-modelview__color-swatch';
		swatch.style.background = "linear-gradient(135deg, rgb(" +
			firstColor.join(",") + ") 0%, rgb(" + firstColor.join(",") +
			") 49%, rgb(" + secondColor.join(",") + ") 51%, rgb(" +
			secondColor.join(",") + ") 100%)";
		swatch.setAttribute('aria-hidden', 'true');
		colorButton.appendChild(swatch);
		colorButton.onclick = function() {
			colortable.querySelectorAll('.rw-modelview__color-option').forEach(function (button) {
				button.classList.remove('active');
				button.setAttribute('aria-pressed', 'false');
			});
			colorButton.classList.add('active');
			colorButton.setAttribute('aria-pressed', 'true');
			LoadColors(c);
		};
		colortable.appendChild(colorButton);
	}

	camDist = 5.0;
	camPitch = 0.3;
	camYaw = 1.0;
	camTarget = [0, 0, 0];
	SetCarColors(selectedColorIndex >= 0 ? uniqueColors[selectedColorIndex] : undefined);

	loadCar(model + ".dff");

	window.location.hash = currentGame + '/' + model;
}

function
LoadVehicle(fields)
{
	let mi = {};
	mi.model = fields[1];
	mi.colors = [];
	ModelInfosName[mi.model] = mi;
}

function
LoadColour(fields)
{
	let r = Number(fields[0]);
	let g = Number(fields[1]);
	let b = Number(fields[2]);
	VehicleColours.push([r, g, b]);
}

function
LoadVehicleColour(fields)
{
	let mi = ModelInfosName[fields[0]];
	for(let i = 1; i < fields.length; i += 2){
		let c1 = Number(fields[i]);
		let c2 = Number(fields[i+1]);
		mi.colors.push([c1, c2]);
	}
}

function
LoadVehicleColour4(fields)
{
	let mi = ModelInfosName[fields[0]];
	for(let i = 1; i < fields.length; i += 4){
		let c1 = Number(fields[i]);
		let c2 = Number(fields[i+1]);
		let c3 = Number(fields[i+2]);
		let c4 = Number(fields[i+3]);
		mi.colors.push([c1, c2, c3, c4]);
	}
}

function
LoadObjectTypes(text)
{
	LoadSectionedFile(text, {
		"cars": LoadVehicle
	});
}

function
LoadVehicleColours(text)
{
	LoadSectionedFile(text, {
		"col": LoadColour,
		"car": LoadVehicleColour,
		"car4": LoadVehicleColour4
	});
}

function
LoadSectionedFile(text, sections)
{
	let section = "end";
	let lines = text.split("\n");
	for(let i = 0; i < lines.length; i++){
		let line = lines[i].replace(/,/g, " ").replace(/#.*/g, "").trim().toLowerCase();
		if(line.length == 0)
			continue;
		let fields = line.split(/[\t ]+/);

		if(section == "end"){
			section = fields[0];
			continue;
		}
		if(fields[0] == "end"){
			section = "end";
			continue;
		}

		if(section in sections)
			sections[section](fields);
	}
}

function
loadText(filename, cb)
{
	let req = new XMLHttpRequest();
	req.open("GET", DataDirPath + "/" + filename, true);
	req.responseType = "text";

	req.onload = function(oEvent){
		if (req.status < 200 || req.status >= 300) {
			showViewerError("Não foi possível carregar os dados do visualizador. Tente recarregar a página.");
			console.error("Falha ao carregar dados:", req.status, req.responseURL);
			return;
		}
		cb(req.response);
	};

	req.onerror = function () {
		showViewerError("Verifique sua conexão e tente recarregar a página.");
		console.error("Falha de rede ao carregar dados:", req.responseURL);
	};

	req.send(null);
}

function
loadVehicleViewer(idefile, CB)
{
	VehicleColours = [];
	ModelInfosName = {};

	loadText(idefile, function(text){
		LoadObjectTypes(text);
		loadText("carcols.dat", function(text){
			LoadVehicleColours(text);
			CB();
		});
	});
}
