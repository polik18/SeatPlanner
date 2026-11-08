(function () {
  'use strict';
  const C = {
    toWorld(camera, point) { return { x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale }; },
    toScreen(camera, point) { return { x: point.x * camera.scale + camera.x, y: point.y * camera.scale + camera.y }; },
    center(camera, viewport, point) { camera.x = viewport.width / 2 - point.x * camera.scale; camera.y = viewport.height / 2 - point.y * camera.scale; },
    fit(camera, viewport, box, padding = 48) {
      camera.scale = Math.max(0.1, Math.min(4, (viewport.width - padding * 2) / box.width, (viewport.height - padding * 2) / box.height));
      C.center(camera, viewport, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    },
    zoomAt(camera, point, scale) {
      const world = C.toWorld(camera, point);
      camera.scale = Math.max(0.1, Math.min(4, scale));
      camera.x = point.x - world.x * camera.scale; camera.y = point.y - world.y * camera.scale;
    }
  };
  window.SeatMaster.classroomCamera = C;
})();
