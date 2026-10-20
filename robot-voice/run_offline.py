"""Linux-only render wrapper: deny network syscalls for this process and children.

The model and all dependencies must already be local. This is stronger than a
runtime telemetry preference: native extensions also cannot open sockets.
"""
import ctypes
import errno
import runpy
import sys

lib = ctypes.CDLL("libseccomp.so.2", use_errno=True)
lib.seccomp_init.argtypes = [ctypes.c_uint32]
lib.seccomp_init.restype = ctypes.c_void_p
lib.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
lib.seccomp_syscall_resolve_name.restype = ctypes.c_int
lib.seccomp_rule_add.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint]
lib.seccomp_rule_add.restype = ctypes.c_int
lib.seccomp_load.argtypes = [ctypes.c_void_p]
lib.seccomp_load.restype = ctypes.c_int
lib.seccomp_release.argtypes = [ctypes.c_void_p]
ctx = lib.seccomp_init(0x7FFF0000)  # allow non-network system calls
if not ctx:
    raise RuntimeError("Cannot create offline render policy")
try:
    for name in (b"socket", b"socketpair", b"connect", b"sendto", b"sendmsg", b"sendmmsg", b"io_uring_setup"):
        syscall = lib.seccomp_syscall_resolve_name(name)
        if syscall >= 0 and lib.seccomp_rule_add(ctx, 0x00050000 | errno.EPERM, syscall, 0):
            raise RuntimeError("Cannot block network syscall")
    if lib.seccomp_load(ctx):
        raise RuntimeError("Cannot activate offline render policy")
finally:
    lib.seccomp_release(ctx)

# Verify the restriction before importing any speech/inference package.
import socket
try:
    socket.socket(socket.AF_INET, socket.SOCK_STREAM)
except PermissionError:
    print("Offline render policy active: network sockets denied.", flush=True)
else:
    raise RuntimeError("Network restriction did not take effect")

if sys.argv[1:] == ["--self-test"]:
    sys.exit(0)
script = sys.argv[1]
sys.argv = sys.argv[1:]
runpy.run_path(script, run_name="__main__")
