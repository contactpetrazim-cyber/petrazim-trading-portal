/**
 * MultiTimeframeLadderTable — shared SMC-concept component (SMC Bot
 * Academy plan item 3): which real timeframes each bot's own
 * `analyze()` actually takes, in HTF-to-LTF order, read directly off
 * each method's real parameter list in `bot_strategies.py` — not a
 * generalized "bots use multiple timeframes" statement.
 *
 * Verified line-by-line against each bot's `def analyze(...)`
 * signature:
 *   Bot 1 (MacroSwingStructureBot):  1D, 4H
 *   Bot 2 (OrderBlockReversalBot):   4H, 1H, 15M
 *   Bot 3 (FVGExpansionBot):         1H, 15M
 *   Bot 4 (VolumeLiquidityBot):      4H, 1H
 *   Bot 5 (JeafxSMCBot):             4H, 1H, 15M, 5M
 *   Bot 6 (JeafxSMCv2Bot):           1H, 15M, 5M
 *   Bot 7 (FVGExpansionV3Bot):       1H, 15M
 */
const ROWS: { bot: string; name: string; timeframes: string[] }[] = [
  { bot: 'Bot 1', name: 'Macro Swing Structure', timeframes: ['1D', '4H'] },
  { bot: 'Bot 2', name: 'Order Block Reversal', timeframes: ['4H', '1H', '15M'] },
  { bot: 'Bot 3', name: 'Imbalance Expansion (FVG)', timeframes: ['1H', '15M'] },
  { bot: 'Bot 4', name: 'Volume & Liquidity Sweep', timeframes: ['4H', '1H'] },
  { bot: 'Bot 5', name: 'Liquidity Purge Specialist', timeframes: ['4H', '1H', '15M', '5M'] },
  { bot: 'Bot 6', name: 'SMC v2', timeframes: ['1H', '15M', '5M'] },
  { bot: 'Bot 7', name: 'FVG Expansion v3', timeframes: ['1H', '15M'] },
];

const ALL_TFS = ['1D', '4H', '1H', '15M', '5M'];

export function MultiTimeframeLadderTable({ dark = false }: { dark?: boolean }) {
  const cardCls = `rounded-2xl p-5 border overflow-x-auto ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const headCls = `text-left text-[11px] font-semibold uppercase tracking-wide py-2 px-2 ${mutedCls}`;
  const cellCls = `text-sm py-2 px-2 border-t ${dark ? 'border-corporate-border-dark' : 'border-corporate-bg'}`;

  return (
    <div className={cardCls}>
      <div className={`text-sm font-semibold mb-3 ${textCls}`}>Multi-Timeframe Ladder</div>
      <table className="w-full min-w-[480px]">
        <thead>
          <tr>
            <th className={headCls}>Bot</th>
            {ALL_TFS.map((tf) => (
              <th key={tf} className={`${headCls} text-center`}>{tf}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.bot}>
              <td className={`${cellCls} ${textCls} font-medium`}>
                {row.bot}
                <div className={`text-[11px] ${mutedCls}`}>{row.name}</div>
              </td>
              {ALL_TFS.map((tf) => (
                <td key={tf} className={`${cellCls} text-center`}>
                  {row.timeframes.includes(tf) ? (
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ background: tf === row.timeframes[0] ? '#2563eb' : '#94a3b8' }}
                      title={tf === row.timeframes[0] ? 'Highest timeframe (direction/structure)' : 'Lower timeframe (confirmation/entry)'}
                    />
                  ) : (
                    <span className={mutedCls}>—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`mt-3 text-xs ${mutedCls}`}>
        Blue dot = the bot's highest timeframe (where direction/structure is read first). Gray
        dot = a lower timeframe used for confirmation or entry timing. Read directly off each
        bot's real <code>analyze()</code> parameter list in <code>bot_strategies.py</code> — not
        a generalized claim that every bot uses "multiple timeframes."
      </div>
    </div>
  );
}
