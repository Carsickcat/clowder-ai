# F010 final reporting-iPhone acceptance

Date: 2026-07-19
Review-Target-ID: `f010`
Product commit: `7db93bf0e6c8e55f939c18c52c1c0baad3b11f1d`
Acceptance BUILD_ID: `n7WolIZtBPCkffGf2i6VS`
Verdict: **PASS**

## Evidence identity

- Original recording: `C:\Users\myh_1\Desktop\录屏3.mp4`
- Recording SHA-256: `ab333489b14a95b7630632511406ea847c0a3130294609c942cb11cf11dab555`
- Recording length: 44.5 s
- Provenance screenshot: `project-evidence/f010-mobile-pwa/final-iphone-trace-n7wol.jpg`
- First focus screenshot: `project-evidence/f010-mobile-pwa/final-iphone-first-focus-n7wol.png`
- Second focus screenshot: `project-evidence/f010-mobile-pwa/final-iphone-second-focus-n7wol.png`
- Reviewed frame-report output:
  `project-evidence/f010-mobile-pwa/final-iphone-frame-report-n7wol.json`
- Independent code review: message `0001784453417251-000118-7f4f5176`, P1/P2/P3 all zero.

The HUD screenshot proves that this was the exact accepted artifact rather than an older installed
PWA: schema version 2, BUILD_ID `n7WolIZtBPCkffGf2i6VS`, same-origin API
`https://desktop-9o1va3o.tail58c13e.ts.net:8443`, Service Worker status `success`, activated
controller at the same origin, and one enumerated cache. The final event visible in the screenshot
is `#70 document.focusout/settled/after` with `inner=797`, `vv=797@0`, `shell=797@0`, and composer
top `707`.

The full copied JSON could not be pasted into the thread. This report therefore does not claim a
complete event-by-event trace archive. The operator explicitly authorized the screenshot as the
available trace evidence for the final verdict:

- proposal message: `0001784453555290-000120-dfd337d3` (requested video plus copied trace);
- operator message: `0001784453991227-000123-b4c9fa8e`;
- quote: “录屏已保存，但Trace无法粘贴，我把图片发你了，你参考一下给出最终验收结论吧”;
- accepted substitution: provenance/final-state screenshot plus original recording and the reviewed
  frame-report harness.

## Machine verdict

The approved frame-report v1.1.0 was run at its calibrated 4fps gate and again at 8fps as a
sensitivity check.

| Metric | 4fps gate | 8fps sensitivity | Verdict |
|---|---:|---:|---|
| Post-launch significant blank runs | 0 | 0 | PASS |
| Longest post-launch blank run | 0 s | 0 s | PASS |
| `shellNeverBlank` | true | true | PASS |
| Composer loss over 1 s | 0 | 0 | PASS |
| Total raw composer-absent time | 1.00 s | 1.12 s | reviewed below |

The 4fps composer detector reported 0.25 s at 37.00–37.25 and 0.75 s at 43.75–44.50. Direct frame
inspection shows the composer visible at 37.00 and 37.25; this is a conservative color-detector
false negative. At 43.75 the operator had already opened iOS Control Center to stop recording, so
that interval is outside application behavior. Neither interval represents the former multi-second
composer disappearance.

## User journey and vision match

| Journey step | Actual reporting-iPhone behavior | Evidence | Match |
|---|---|---|---|
| Cold start exact PWA | Target HUD/build and same-origin SW/API appear; no post-launch blank run | video + trace screenshot | yes |
| First composer focus | Header/transcript remain visible; composer stays immediately above Chinese IME | first-focus screenshot + video | yes |
| Mention and send | `@` roster appears, `@opus45` is selected, Chinese text is entered and sent | video | yes |
| Live result | The sent message and responding cat card appear without a reload | video contact-sheet review | yes |
| Blur | Keyboard leaves; Dock/composer return without whole-shell disappearance | video + HUD final geometry | yes |
| Refocus and final blur | Second focus remains stable and final blur returns to `797@0` shell geometry | second-focus screenshot + trace screenshot | yes |

Operator experience mapping:

| Reported failure | Final observed behavior | Match |
|---|---|---|
| “打开输入框还是有跳动” / whole shell disappears | Two focus/blur journeys contain zero post-launch shell blank runs and no visible shell jump | yes |
| Mention picker has no cats | Picker exposes cats; `@opus45` selection and send complete | yes |
| Composer disappears for seconds | No >1 s loss; both sampled focus frames show composer above IME | yes |

## Final conclusion

The same-build reporting-iPhone release gate is **PASS**. Combined evidence is: exact installed-PWA
provenance, original video, two-rate machine frame analysis, direct key-frame inspection, deterministic
viewport/catalog tests, and independent cross-cat code review. This closes the recorded F010
keyboard blank/jump, composer disappearance, and empty mention-picker incident for product
acceptance. Feature lifecycle completion still follows the repository merge/truth-sync gate; this
report does not fabricate a merge that has not happened.

## Final quality gate

### Vision and delivery completeness

- Original failure journey: open composer without shell jump, use Chinese IME, summon/select a cat,
  send, dismiss, refocus, and dismiss again.
- Dogfood-Your-Slice: the operator ran that exact journey on the reporting iPhone; the video and
  three screenshots above are the direct evidence.
- User-visible product scope is complete for this incident; no keyboard/catalog behavior is being
  deferred. The only substituted artifact is full trace text transfer, explicitly accepted by the
  operator with the four-part provenance recorded above.

### Fresh verification after device replay

- viewport + catalog + retry Vitest: **3 files / 34 tests passed**;
- Web TypeScript: passed;
- target Biome: six product/evidence files clean after adding the required final newline to the
  generated JSON;
- `git diff --check`: passed;
- `pnpm check:capability-tips`: passed (repository/shallow-history warnings only);
- matching F010/mobile/keyboard/viewport `.pen`: none;
- root-level media/design artifacts in working tree or discoverable committed diff: none;
- architecture cell: `hub-action-surface`; map delta: `none`; no new Store/Queue/Router/Adapter/
  Dispatcher/Binding owner was introduced;
- branch-local hotfix/fallback scripts and architecture-ownership command: unavailable, recorded as
  unavailable rather than green;
- GitHub CLI: unavailable on this host, so no PR-state claim is made.

The production build was intentionally not regenerated after device replay: rebuilding would
replace `.next` and sever the exact BUILD_ID identity just accepted on the iPhone. Its build gate
had already passed at product commit `7db93bf`; the fresh runtime proof is the exact-build device
journey itself.

[丢丢/gpt-5.6-sol🐾]
