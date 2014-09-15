#version 100

float f(float, float);
float f();

void main() {
    float a, b;
    vec2 c[4];
    vec2 d;
    const int i = 1;

    a = float(2 + 1 * 3 + int(f(b, d.x) - d.x / 5.1) + 0555 + 0xef09 + -2);
    b++;
    ++b;
    b--;
    --b;

    !bool(a);

    a == 3.0 ? 1 + 2 : 3 * 4;
    a != 2.0;
    c[i + 1].x;

    bool(a) || bool(b) && bool(c[0].x) || (bool(d.y) && !bool(c[0].y));

    a, b, c;

    a += 2.0;
    a -= 2.0;
    a *= 2.0;
    a /= 2.0;

    f();
}

// vi:ts=4:et
