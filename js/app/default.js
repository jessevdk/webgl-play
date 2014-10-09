function init(c) {
    this.box = new c.models.Box(c, 1, 1, 1);
    this.view = c.models.View.perspective(c, 60, null, 0.01, 50);
    this.view.transform.$translateZ(5);
}

function render(c) {
    c.view(this.view);
    this.box.render(c);
}
