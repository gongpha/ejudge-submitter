import sys
from io import StringIO
try :
    f = open(sys.argv[1], "rb")
    src = f.read()
    buffer = StringIO()
    sys.stdin = StringIO(bytes(sys.argv[2], "utf-8").decode('unicode_escape') + '\n')
    sys.stdout = buffer
    exec(src)
    sys.stdout = sys.__stdout__
    print("t" if buffer.getvalue() == bytes(sys.argv[3], "utf-8").decode('unicode_escape') + '\n' else "f")
except Exception as e :
    sys.stdout = sys.__stdout__
    print("e" + type(e).__name__)
