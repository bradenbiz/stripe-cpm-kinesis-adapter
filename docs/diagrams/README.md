# Architecture diagrams

Mermaid sources for the Stripe CPM × Kinesis Pay integration. GitHub
renders these inline when you open the `.mermaid` files in the web UI;
they also render in any Mermaid-aware tooling (Obsidian, VS Code with
the Mermaid extension, the live editor at mermaid.live).

## Files

| File | Diagram type | What it shows |
|---|---|---|
| [`sequence.mermaid`](./sequence.mermaid) | Sequence diagram | End-to-end payment lifecycle from customer click → Kinesis approval → merchant success page |
| [`architecture.mermaid`](./architecture.mermaid) | Component view | Customer, Merchant, Stripe, and Kinesis infrastructure groupings and the calls between them |
| [`state-machine.mermaid`](./state-machine.mermaid) | State diagram | The Kinesis Pay payment lifecycle (`created → processed / rejected / expired`) |

The sequence diagram models the verified working flow from May 19, 2026:
Stripe PaymentIntent `pi_3TZ2FDECfbjpTBhp0ydDBtDc` ↔ Kinesis payment
`KPU7L5HF4CT5`.

## Rendering to PNG / SVG

For embedding in external documents:

```sh
# One-off:
npx -p @mermaid-js/mermaid-cli mmdc \
  -i docs/diagrams/sequence.mermaid \
  -o docs/diagrams/sequence.png -w 1600

# All three:
for d in sequence architecture state-machine; do
  npx -p @mermaid-js/mermaid-cli mmdc \
    -i "docs/diagrams/$d.mermaid" \
    -o "docs/diagrams/$d.png" -w 1600
done
```

Rendered `.png` outputs are gitignored — render fresh each time, or
commit them to a release tag if you want a stable artifact.
