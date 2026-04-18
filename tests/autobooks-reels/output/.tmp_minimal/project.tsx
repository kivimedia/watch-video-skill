
import { makeProject } from '@revideo/core';
import { makeScene2D } from '@revideo/2d';
import { Rect, Txt } from '@revideo/2d/lib/components';
import { waitFor } from '@revideo/core/lib/flow';
import { createRef } from '@revideo/core/lib/utils';

const testScene = makeScene2D('test', function* (view) {
  const bg = createRef();
  const txt = createRef();

  view.add(<Rect ref={bg} width={1080} height={1920} fill="#2BA5A5" />);
  view.add(<Txt ref={txt} text="Hello CutSense!" fontSize={64} fill="#ffffff" fontWeight={700} />);

  yield* waitFor(2);
});

export default makeProject({
  scenes: [testScene],
  settings: {
    size: { x: 1080, y: 1920 },
    fps: 30,
    background: '#2BA5A5',
  },
});
