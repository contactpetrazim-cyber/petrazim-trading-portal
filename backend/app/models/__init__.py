
from .market_structure import *
from .trade import *
from .bot import *
from .analytics import *

# v2/v3 additions — imported here (even where no router uses them yet)
# so every model class registers with app.database.Base.metadata before
# main.py's create_all() runs. See MERGE_MANIFEST.md.
from .user import *
from .access import *
from .telegram_link import *
from .curriculum import *
from .marketplace import *
from .signal_api import *
from .white_label import *
from .chart_layout import *
from .facilitator import *
from .roster import *
