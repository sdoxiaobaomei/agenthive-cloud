from jinja2 import Environment

env = Environment(
    variable_start_string='${',
    variable_end_string='}',
    lstrip_blocks=True,
    trim_blocks=True
)

# Test 1: raw block
try:
    t1 = env.from_string('{% raw %}${}{% endraw %}').render()
    print('Test1 raw block:', repr(t1))
except Exception as e:
    print('Test1 raw block FAILED:', e)

# Test 2: escape with string
try:
    t2 = env.from_string("${'${}'}").render()
    print('Test2 string literal:', repr(t2))
except Exception as e:
    print('Test2 string literal FAILED:', e)

# Test 3: using variable
try:
    t3 = env.from_string('${dollar}').render(dollar='${}')
    print('Test3 variable:', repr(t3))
except Exception as e:
    print('Test3 variable FAILED:', e)
