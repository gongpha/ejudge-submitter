import sys
from io import StringIO
f = open(sys.argv[1], "rb")
src = f.read()
buffer = StringIO()
sys.stdin = StringIO(sys.argv[2])
sys.stdout = buffer
exec(src)
sys.stdout = sys.__stdout__
print("t" if buffer.getvalue() == sys.argv[3] else "f")
