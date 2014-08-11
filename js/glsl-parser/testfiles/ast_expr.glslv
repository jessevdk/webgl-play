#version 100

void main() {
    a = 2 + 1 * 3 + f(b, c) - c.xx / 5.1 + 0555 + 0xef09 + -2;
    b++;
    ++b;
    b--;
    --b;

    !c;

    c == 3 ? 1 + 2 : 3 * 4;
    c != 2;
    c[i + 2].field;

    a || b && c || (d && !c);

    a, b, c;

    a += 2;
    a -= 2;
    a *= 2;
    a /= 2;

    f(void);
}

// vi:ts=4:et
