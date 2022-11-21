import sys
from io import StringIO
from timeit import default_timer as timer

try :
    f = open(sys.argv[1], "rb")
    src = f.read()
    buffer = StringIO()
    sys.stdin = StringIO(bytes(sys.argv[2], "utf-8").decode('unicode_escape') + '\n')
    sys.stdout = buffer
    start = timer()
    exec(src)
    end = timer()
    sys.stdout = sys.__stdout__
    print(
        ("t" if buffer.getvalue() == bytes(sys.argv[3], "utf-8").decode('unicode_escape') + '\n' else "f") +
        str(end - start)
    )
except Exception as e :
    sys.stdout = sys.__stdout__
    print("e" + type(e).__name__)
