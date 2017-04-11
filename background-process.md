
Background process management will need some features that does not exist in Node.js.

Interesting SO about foreground/background process management:
http://stackoverflow.com/questions/5341220/how-do-i-get-tcsetpgrp-to-work-in-c

I may need to write my bindings to tcsetpgrp(), tcgetpgrp(), or use this undocumented package:
https://www.npmjs.com/package/termcontrol

May also need setpgid(), setpgrp(), getpgrp().

