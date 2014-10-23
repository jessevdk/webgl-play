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
 * Get all render parts of the group.
 */
RenderGroups.prototype.renderParts = function() {
    return this.groups;
}

module.exports = RenderGroups;

// vi:ts=4:et
