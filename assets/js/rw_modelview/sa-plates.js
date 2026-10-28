(function (global) {
	const regions = [
		{ id: "san-fierro", texture: "plateback1" },
		{ id: "las-venturas", texture: "plateback2" },
		{ id: "los-santos", texture: "plateback3" }
	];
	const fixedPlatesByModel = {
		// modelName: { region: "los-santos", text: "ABC 123" }
	};
	let selectedRegion = null;
	let loadedAssets;
	let backgroundTexture = null;
	let charactersTexture = null;
	let currentPlate = null;

	function loadImage(name) {
		return new Promise(function (resolve, reject) {
			const image = new Image();
			image.onload = function () { resolve(image); };
			image.onerror = function () {
				reject(new Error("Não foi possível carregar a textura " + name + "."));
			};
			image.src = TexturesDirPath + "/" + name + ".png";
		});
	}

	function loadAssets() {
		if (!loadedAssets) {
			loadedAssets = Promise.all([
				Promise.all(regions.map(function (region) {
					return loadImage(region.texture);
				})),
				loadImage("platecharset")
			]).then(function (assets) {
				return {
					backgrounds: assets[0],
					characters: prepareCharacterAtlas(assets[1])
				};
			}).catch(function (error) {
				loadedAssets = null;
				throw error;
			});
		}
		return loadedAssets;
	}

	function prepareCharacterAtlas(image) {
		const canvas = document.createElement("canvas");
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		context.drawImage(image, 0, 0);

		const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
		const background = [173, 181, 181];
		const ink = [8, 41, 99];
		const inkRange = background.map(function (value, index) {
			return value - ink[index];
		});

		for (let i = 0; i < pixels.data.length; i += 4) {
			const coverage = Math.max(
				(background[0] - pixels.data[i]) / inkRange[0],
				(background[1] - pixels.data[i + 1]) / inkRange[1],
				(background[2] - pixels.data[i + 2]) / inkRange[2]
			);
			pixels.data[i] = ink[0];
			pixels.data[i + 1] = ink[1];
			pixels.data[i + 2] = ink[2];
			pixels.data[i + 3] = Math.round(Math.max(0, Math.min(1, coverage)) * 255);
		}

		context.putImageData(pixels, 0, 0);
		return canvas;
	}

	function randomCharacter(characters) {
		return characters[Math.floor(Math.random() * characters.length)];
	}

	function generatePlateText() {
		const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		const digits = "0123456789";
		return randomCharacter(letters) + randomCharacter(letters) +
			randomCharacter(letters) + " " +
			randomCharacter(digits) + randomCharacter(digits) +
			randomCharacter(digits);
	}

	function getPlateOverride(modelName) {
		const override = fixedPlatesByModel[modelName.toLowerCase()];
		if (!override) return null;

		if (typeof override.text !== "string" ||
			!/^[A-Z0-9 ]{1,8}$/.test(override.text)) {
			console.error("Configuração de placa fixa inválida para o modelo:", modelName);
			return null;
		}
		return override;
	}

	function drawPlateBackground(assets, region) {
		const canvas = document.createElement("canvas");
		canvas.width = 64;
		canvas.height = 32;
		const context = canvas.getContext("2d");
		context.imageSmoothingEnabled = false;
		context.drawImage(assets.backgrounds[regions.indexOf(region)], 0, 0, 64, 32);
		return canvas;
	}

	function drawPlateCharacters(assets, text) {
		const canvas = document.createElement("canvas");
		canvas.width = 64;
		canvas.height = 32;
		const context = canvas.getContext("2d");
		context.imageSmoothingEnabled = false;

		const glyphWidth = 8;
		const glyphHeight = 16;
		const startX = Math.floor((canvas.width - text.length * glyphWidth) / 2);
		const y = 8;
		for (let i = 0; i < text.length; i++) {
			const character = text[i];
			if (character === " ") continue;

			const index = character >= "A" && character <= "Z" ?
				character.charCodeAt(0) - 65 :
				26 + character.charCodeAt(0) - 48;
			context.drawImage(
				assets.characters,
				(index % 4) * glyphWidth,
				Math.floor(index / 4) * glyphHeight,
				glyphWidth,
				glyphHeight,
				startX + i * glyphWidth,
				y,
				glyphWidth,
				glyphHeight
			);
		}
		return canvas;
	}

	function uploadTexture(canvas, texture) {
		if (!texture)
			texture = gl.createTexture();

		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
			gl.UNSIGNED_BYTE, canvas);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		return texture;
	}

	function apply(clump, modelName) {
		if (!selectedRegion)
			selectedRegion = regions[Math.floor(Math.random() * regions.length)];

		const override = getPlateOverride(modelName);
		const region = override && override.region ?
			regions.find(function (item) { return item.id === override.region; }) :
			selectedRegion;
		if (override && override.region && !region)
			console.error("Região de placa fixa inválida para o modelo:", modelName);

		const plateRegion = region || selectedRegion;
		const text = override ? override.text : generatePlateText();
		const materials = { background: [], characters: [] };
		for (let i = 0; i < clump.atomics.length; i++) {
			const geometryMaterials = clump.atomics[i].geometry.materials;
			for (let j = 0; j < geometryMaterials.length; j++) {
				const material = geometryMaterials[j];
				const name = material.texture && material.texture.name.toLowerCase();
				if (name === "carpback")
					materials.background.push(material);
				else if (name === "carplate")
					materials.characters.push(material);
			}
		}

		if (materials.background.length === 0 && materials.characters.length === 0) {
			currentPlate = { region: plateRegion.id, text: text, applied: false };
			return Promise.resolve(currentPlate);
		}

		return loadAssets().then(function (assets) {
			if (materials.background.length > 0) {
				backgroundTexture = uploadTexture(
					drawPlateBackground(assets, plateRegion), backgroundTexture);
				for (let i = 0; i < materials.background.length; i++)
					materials.background[i].texture.tex = backgroundTexture;
			}

			if (materials.characters.length > 0) {
				charactersTexture = uploadTexture(
					drawPlateCharacters(assets, text), charactersTexture);
				for (let i = 0; i < materials.characters.length; i++)
					materials.characters[i].texture.tex = charactersTexture;
			}

			currentPlate = { region: plateRegion.id, text: text, applied: true };
			return currentPlate;
		});
	}

	global.SAPlateSystem = {
		apply: apply,
		fixedPlatesByModel: fixedPlatesByModel,
		getCurrentPlate: function () { return currentPlate; }
	};
})(window);
