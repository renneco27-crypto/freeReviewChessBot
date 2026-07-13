"""Export Maia3-5M PyTorch model to ONNX for browser inference."""
import torch, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'testv1', 'maia3'))

from maia3.models import MAIA3Model
from maia3.model_registry import resolve_model_spec, apply_model_config, resolve_checkpoint_path

spec = resolve_model_spec("maia3-5m")
ckpt = resolve_checkpoint_path(spec)

class Args: pass
cfg = Args()
cfg.device = 'cpu'
cfg.use_amp = False
apply_model_config(cfg, spec)
cfg.use_rms_norm = False

model = MAIA3Model(cfg)
state = torch.load(ckpt, map_location='cpu', weights_only=True)
sd = state["model_state_dict"] if isinstance(state, dict) and "model_state_dict" in state else state
sd = {k.replace("smolgen","gab"): v for k, v in sd.items()}
model.load_state_dict(sd, strict=False)
model.eval()

# Dummy inputs — shape matches get_historical_tokens output:
#   (64, 12*history + 1) where +1 is clk_ponder (always 0)
B = 1
dummy_tokens = torch.randn(B, 64, 12 * cfg.history + 1, dtype=torch.float32)
dummy_elos = torch.tensor([1500], dtype=torch.long)

torch.onnx.export(
    model,
    (dummy_tokens, dummy_elos, dummy_elos),
    "maia3.onnx",
    input_names=["tokens", "self_elo", "oppo_elo"],
    output_names=["logits_move", "logits_value", "ponder"],
    dynamic_axes={
        "tokens": {0: "batch"},
        "self_elo": {0: "batch"},
        "oppo_elo": {0: "batch"},
    },
    opset_version=17,
    dynamo=False,
)
print("OK — maia3.onnx written")
