function init(c) {
    this.box = new c.models.Box(c, 1, 1, 1);
    this.view = c.models.View.perspective(c, 45, null, 0.01, 50);

    this.view.transform
        .rotateY(-Math.PI / 6)
        .rotateX(-Math.PI / 6)
        .translateForward(3);
}

function render(c) {
    c.view(this.view);
    this.box.render(c);
}
