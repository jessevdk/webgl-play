#version 100

struct usertype {
    bool valid;
};

int f();
usertype ft();

void main() {
    int i = 0;

    // simple while loop
    while (i < 10) {
        i++;
    }

    i = 0;

    // without braces
    while (i < 10)
        i++;

	while (bool t = (f() < 10)) {
    }

    while (bool t = ft().valid) {
    }

    bool t;

    while (t = (f() < 10)) {
    }
}

// vi:ts=4:et
