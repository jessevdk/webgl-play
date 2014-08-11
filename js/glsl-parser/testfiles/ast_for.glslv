#version 100

void main() {
    // simple for loop
    for (i = 0; i < 10; i++) {
        // something
    }

    // without expression
    for (i = 2; i < 4;) {
        i++;
    }

    // without braces
    for (i = 10; i > 5; i--)
        ;

    // with inline declaration
    for (int i = 10; i > 5; i--) {
    }

    // with multiple inline declaration
    for (int i = 10, j = 5; i > 5; i--, j--) {
    }

    // without inline expression declaration
    for (int i = 10; bool a = i > 5; i--) {
    }
}

// vi:ts=4:et
