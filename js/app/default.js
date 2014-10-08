function init(c) {
    // Create a simple box
    this.box = new c.models.Box(c, 1, 1, 1);

    // Create a basic view
    this.view = c.models.View.perspective(c, 60, null, -1, 50);
}

function render(c) {
    c.view(this.view);

    this.box.render(c);
}
