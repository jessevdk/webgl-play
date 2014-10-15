/**
 * A collection of render groups.
 */
function RenderGroups() {
    this.groups = [];
}

/**
 * Add a render group.
 *
 * @param group the group to add.
 */
RenderGroups.prototype.add = function(group) {
    this.groups.push(group);
}

/**
 * Remove a render group.
 *
 * @param group the group to remove.
 */
RenderGroups.prototype.remove = function(group) {
    var idx = this.groups.indexOf(group);

    if (idx !== -1) {
        this.groups.splice(idx, 1);
    }
}

/**
 * Render all the render groups.
 *
 * @ctx the context.
 */
RenderGroups.prototype.render = function(ctx) {
    var geom = null;

    for (var i = 0; i < this.groups.length; i++) {
        var group = this.groups[i];

        if (group.geometry !== geom) {
            if (geom !== null) {
                geom.unbind(ctx);
            }

            group.geometry.bind(ctx);
        }

        group.render(ctx, true);

        geom = group.geometry;
    }

    if (geom !== null) {
        geom.unbind(ctx);
    }
}

module.exports = RenderGroups;

// vi:ts=4:et