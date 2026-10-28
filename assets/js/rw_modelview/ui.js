autoRotateCamera = false;

var viewerHelpButton = document.getElementById("viewer-help-button");
var viewerHelpPanel = document.getElementById("viewer-help-panel");
var viewerViewButton = document.getElementById("viewer-view-button");
var viewerViewPanel = document.getElementById("viewer-view-panel");
var viewerActions = document.getElementById("viewer-actions");
var viewerLoader = document.getElementById("viewer-loader");

document.querySelectorAll(".rw-modelview__tools-toggle").forEach(function (toggle) {
  toggle.addEventListener("click", function () {
    var viewer = toggle.closest(".rw-modelview");
    var actionTools = viewer.querySelector(".rw-modelview__action-tools");
    var helpButton = viewer.querySelector("#viewer-help-button");
    var helpPanel = viewer.querySelector(".rw-modelview__help-panel");
    var viewButton = viewer.querySelector("#viewer-view-button");
    var viewPanel = viewer.querySelector(".rw-modelview__view-panel");
    var isVisible = toggle.getAttribute("aria-expanded") === "true";
    actionTools.hidden = isVisible;
    toggle.setAttribute("aria-expanded", String(!isVisible));

    var label = isVisible ? "Mostrar botões" : "Esconder botões";
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
    toggle.querySelector("i").classList.toggle("fa-eye", isVisible);
    toggle.querySelector("i").classList.toggle("fa-eye-slash", !isVisible);

    if (isVisible) {
      helpPanel.hidden = true;
      viewPanel.hidden = true;
      helpButton.setAttribute("aria-expanded", "false");
      viewButton.setAttribute("aria-expanded", "false");
    }
  });
});

function
hideViewerLoader() {
  viewerLoader.classList.add("is-hidden");
  viewerLoader.setAttribute("aria-hidden", "true");
}

function
showViewerError(message) {
  var title = viewerLoader.querySelector(".rw-modelview__loader-title");
  var progress = viewerLoader.querySelector(".rw-modelview__loader-progress");
  var errorMessage = viewerLoader.querySelector(".rw-modelview__loader-message");

  viewerLoader.classList.add("rw-modelview__loader--error");
  viewerLoader.setAttribute("aria-label", "Erro ao carregar visualizador");
  title.textContent = "Não foi possível carregar o visualizador";
  progress.hidden = true;

  if (!errorMessage) {
    errorMessage = document.createElement("p");
    errorMessage.className = "rw-modelview__loader-message";
    viewerLoader.querySelector(".rw-modelview__loader-content").appendChild(errorMessage);
  }
  errorMessage.textContent = message;
  console.error("Visualizador RenderWare:", message);
}

viewerHelpButton.addEventListener("click", function () {
  var isOpen = viewerHelpButton.getAttribute("aria-expanded") === "true";
  viewerViewPanel.hidden = true;
  viewerViewButton.setAttribute("aria-expanded", "false");
  viewerHelpButton.setAttribute("aria-expanded", String(!isOpen));
  viewerHelpPanel.hidden = isOpen;
});

viewerViewButton.addEventListener("click", function () {
  var isOpen = viewerViewButton.getAttribute("aria-expanded") === "true";
  viewerHelpPanel.hidden = true;
  viewerHelpButton.setAttribute("aria-expanded", "false");
  viewerViewButton.setAttribute("aria-expanded", String(!isOpen));
  viewerViewPanel.hidden = isOpen;
});

var cameraViews = {
  front: [Math.PI / 2, 0],
  back: [-Math.PI / 2, 0],
  left: [Math.PI, 0],
  right: [0, 0],
  top: [Math.PI / 2, Math.PI / 2 - 0.01],
  bottom: [Math.PI / 2, -Math.PI / 2 + 0.01],
  "front-left": [3 * Math.PI / 4, 0.45],
  "front-right": [Math.PI / 4, 0.45],
  "back-left": [-3 * Math.PI / 4, 0.45],
  "back-right": [-Math.PI / 4, 0.45]
};

function updateViewCube() {
  var cube = viewerViewPanel.querySelector(".rw-modelview__view-cube");
  var yawOffset = Math.atan2(
    Math.sin(camYaw - Math.PI / 2),
    Math.cos(camYaw - Math.PI / 2)
  );
  var cubePitch = -25 - camPitch * 180 / Math.PI;
  var cubeYaw = -35 + yawOffset * 180 / Math.PI;
  cube.style.transform = "translate(-50%, -50%) rotateX(" +
    cubePitch + "deg) rotateY(" + cubeYaw + "deg)";

  var selectedView = Object.keys(cameraViews).find(function (name) {
    var view = cameraViews[name];
    var yawDifference = Math.atan2(
      Math.sin(camYaw - view[0]),
      Math.cos(camYaw - view[0])
    );
    return Math.abs(yawDifference) < 0.01 &&
      Math.abs(camPitch - view[1]) < 0.01;
  });

  viewerViewPanel.querySelectorAll("[data-view]").forEach(function (option) {
    var isSelected = option.dataset.view === selectedView;
    option.classList.toggle("is-active", isSelected);
    option.setAttribute("aria-pressed", String(isSelected));
  });
}

document.querySelectorAll("[data-view]").forEach(function (button) {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", function () {
    var view = cameraViews[button.dataset.view];
    if (!view) return;

    window.autoRotateCamera = false;
    camYaw = view[0];
    camPitch = view[1];
    updateViewCube();
  });
});

document.querySelectorAll("[data-view-turn]").forEach(function (button) {
  button.addEventListener("click", function () {
    window.autoRotateCamera = false;
    if (button.dataset.viewTurn === "left") camYaw += Math.PI / 2;
    if (button.dataset.viewTurn === "right") camYaw -= Math.PI / 2;
    if (button.dataset.viewTurn === "up") camPitch += Math.PI / 2;
    if (button.dataset.viewTurn === "down") camPitch -= Math.PI / 2;
    camPitch = Math.max(-Math.PI / 2 + 0.01,
      Math.min(Math.PI / 2 - 0.01, camPitch));
    camYaw = Math.atan2(Math.sin(camYaw), Math.cos(camYaw));
    updateViewCube();
  });
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    if (!viewerHelpPanel.hidden) {
      viewerHelpPanel.hidden = true;
      viewerHelpButton.setAttribute("aria-expanded", "false");
      viewerHelpButton.focus();
    } else if (!viewerViewPanel.hidden) {
      viewerViewPanel.hidden = true;
      viewerViewButton.setAttribute("aria-expanded", "false");
      viewerViewButton.focus();
    }
  }
});

document.addEventListener("pointerdown", function (e) {
  if (!viewerActions.contains(e.target)) {
    viewerHelpPanel.hidden = true;
    viewerViewPanel.hidden = true;
    viewerHelpButton.setAttribute("aria-expanded", "false");
    viewerViewButton.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keypress",
function(e) {
  if(e.key === "r") {
    autoRotateCamera = !autoRotateCamera;
  }
},
false);
