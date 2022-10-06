import sys
from io import StringIO
try :
    f = open(sys.argv[1], "rb")
    src = f.read()
    buffer = StringIO()
    sys.stdin = StringIO(sys.argv[2])
    sys.stdout = buffer
    exec(src)
    sys.stdout = sys.__stdout__
    print("t" if buffer.getvalue() == sys.argv[3] + "\n" else "f")
except Exception as e :
    sys.stdout = sys.__stdout__
    print("e" + type(e).__name__)
