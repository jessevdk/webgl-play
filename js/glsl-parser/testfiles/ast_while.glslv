#version 100

void main() {
    // simple while loop
    while (i < 10) {
        i++;
    }

    // without braces
    while (i < 10)
        i++;

	while (int t = f()) {
    }

    while (usertype t = f()) {
    }

    while (t = f()) {
    }
}

// vi:ts=4:et
