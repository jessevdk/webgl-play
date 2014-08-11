#version 100

void main() {
    if (true) {
        // something
    }

    if (true)
        a = 2;

    if (true) {
        // something
    } else if (false) {
        // something else if
    } else {
        // something else
    }

    if (true) {
        // something
    } else
        true;
}

// vi:ts=4:et
