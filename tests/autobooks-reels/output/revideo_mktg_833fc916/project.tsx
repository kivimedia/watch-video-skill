
import { makeProject } from '@revideo/core';
import { makeScene2D } from '@revideo/2d';
import { Txt, Rect, Circle, Line } from '@revideo/2d/lib/components';
import { all, waitFor } from '@revideo/core/lib/flow';
import { easeOutCubic, easeInOutCubic, easeInCubic } from '@revideo/core/lib/tweening';
import { createRef } from '@revideo/core/lib/utils';

const marketingReel = makeScene2D('marketing-reel', function* (view) {
  // White background
  view.add(<Rect width={1080} height={1920} fill={"#FFFFFF"} />);


  // ─── HOOK TEXT SCENE ────────────────────────────
  {
    // Logo
    const hookLogo = createRef();
    view.add(
      <Txt
        ref={hookLogo}
        text={`AutoBooks`}
        fontSize={28}
        fontFamily={`Segoe UI, sans-serif`}
        fontWeight={600}
        fill={"#1a2332"}
        y={-200}
        opacity={0}
      />,
    );


    // Line 1: "You started"
    const hookLine0 = createRef();
    view.add(
      <Txt
        ref={hookLine0}
        text={`You started`}
        fontSize={52}
        fontFamily={`Georgia, serif`}
        fontWeight={700}
        fontStyle={"normal"}
        fill={"#1a2332"}
        y={-60}
        opacity={0}
        textAlign="center"
      />,
    );

    // Line 2: "a business,"
    const hookLine1 = createRef();
    view.add(
      <Txt
        ref={hookLine1}
        text={`a business,`}
        fontSize={52}
        fontFamily={`Georgia, serif`}
        fontWeight={700}
        fontStyle={"normal"}
        fill={"#1a2332"}
        y={10}
        opacity={0}
        textAlign="center"
      />,
    );

    // Line 3: "not an"
    const hookLine2 = createRef();
    view.add(
      <Txt
        ref={hookLine2}
        text={`not an`}
        fontSize={52}
        fontFamily={`Georgia, serif`}
        fontWeight={700}
        fontStyle={"normal"}
        fill={"#1a2332"}
        y={80}
        opacity={0}
        textAlign="center"
      />,
    );

    // Line 4: "accounting"
    const hookLine3 = createRef();
    view.add(
      <Txt
        ref={hookLine3}
        text={`accounting`}
        fontSize={52}
        fontFamily={`Georgia, serif`}
        fontWeight={700}
        fontStyle={"italic"}
        fill={"#2BA5A5"}
        y={150}
        opacity={0}
        textAlign="center"
      />,
    );

    // Line 5: "firm."
    const hookLine4 = createRef();
    view.add(
      <Txt
        ref={hookLine4}
        text={`firm.`}
        fontSize={52}
        fontFamily={`Georgia, serif`}
        fontWeight={700}
        fontStyle={"italic"}
        fill={"#2BA5A5"}
        y={220}
        opacity={0}
        textAlign="center"
      />,
    );

    // Separator line
    const hookSep = createRef();
    view.add(
      <Rect
        ref={hookSep}
        width={60}
        height={4}
        fill={"#2BA5A5"}
        y={310}
        opacity={0}
        radius={2}
      />,
    );
    const hookSub = createRef();
    view.add(
      <Txt
        ref={hookSub}
        text={`So why are you doing your own books?`}
        fontSize={24}
        fontFamily={`Segoe UI, sans-serif`}
        fontWeight={400}
        fill={"#6B778C"}
        y={350}
        opacity={0}
        textAlign="center"
      />,
    );

    // Animate logo in
    yield* hookLogo().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.2);

    // Staggered line reveal
    yield* hookLine0().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.1);
    yield* hookLine1().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.1);
    yield* hookLine2().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.1);
    yield* hookLine3().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.1);
    yield* hookLine4().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.1);

    yield* hookSep().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.2);
    yield* hookSub().opacity(1, 0.4, easeOutCubic);

    // Hold
    yield* waitFor(0.5);

    // Fade everything out
    yield* all(
      hookLogo().opacity(0, 0.3),
      hookLine0().opacity(0, 0.3),
      hookLine1().opacity(0, 0.3),
      hookLine2().opacity(0, 0.3),
      hookLine3().opacity(0, 0.3),
      hookLine4().opacity(0, 0.3),

      hookSep().opacity(0, 0.3),
      hookSub().opacity(0, 0.3),
    );
    yield* waitFor(0.1);
  }


  // ─── VALUE PROP SCENE ───────────────────────────
  {
    const vpLogo = createRef();
    view.add(
      <Txt
        ref={vpLogo}
        text={`AutoBooks`}
        fontSize={28}
        fontFamily={`Segoe UI, sans-serif`}
        fontWeight={600}
        fill={"#1a2332"}
        y={-350}
        opacity={0}
      />,
    );

    const vpHeading = createRef();
    view.add(
      <Txt
        ref={vpHeading}
        text={`Autobooks keeps
your books moving.`}
        fontSize={48}
        fontFamily={`Georgia, serif`}
        fontWeight={700}
        fill={"#1a2332"}
        y={-120}
        opacity={0}
        textAlign="center"
      />,
    );

    // Icon placeholder (rounded square)
    const vpIcon = createRef();
    view.add(
      <Rect
        ref={vpIcon}
        width={100}
        height={100}
        fill={"#1a2332"}
        radius={16}
        y={100}
        opacity={0}
      />,
    );

    yield* all(
      vpLogo().opacity(1, 0.3, easeOutCubic),
      vpHeading().opacity(1, 0.4, easeOutCubic),
    );
    yield* waitFor(0.2);
    yield* vpIcon().opacity(1, 0.3, easeOutCubic);

    yield* waitFor(0.30000000000000004);

    yield* all(
      vpLogo().opacity(0, 0.3),
      vpHeading().opacity(0, 0.3),
      vpIcon().opacity(0, 0.3),
    );
    yield* waitFor(0.1);
  }


  // ─── CONNECTION DIAGRAM SCENE ───────────────────
  {
    const cdLogo = createRef();
    view.add(
      <Txt
        ref={cdLogo}
        text={`AutoBooks`}
        fontSize={28}
        fontFamily={`Segoe UI, sans-serif`}
        fontWeight={600}
        fill={"#1a2332"}
        y={-380}
        opacity={0}
      />,
    );

    const cdHeading = createRef();
    view.add(
      <Txt
        ref={cdHeading}
        text={`Connect Your Bank`}
        fontSize={48}
        fontFamily={`Georgia, serif`}
        fontWeight={700}
        fill={"#1a2332"}
        y={-200}
        opacity={0}
        textAlign="center"
      />,
    );

    // Left circle
    const cdLeftCircle = createRef();
    view.add(
      <Circle
        ref={cdLeftCircle}
        width={140}
        height={140}
        stroke={"#2BA5A5"}
        lineWidth={3}
        y={0}
        x={-160}
        opacity={0}
      />,
    );
    const cdLeftLabel = createRef();
    view.add(
      <Txt
        ref={cdLeftLabel}
        text={`Your Bank`}
        fontSize={16}
        fontFamily={`Segoe UI, sans-serif`}
        fontWeight={600}
        fill={"#1a2332"}
        y={0}
        x={-160}
        opacity={0}
        textAlign="center"
      />,
    );

    // Connection line
    const cdLine = createRef();
    view.add(
      <Line
        ref={cdLine}
        points={[[-90, 0], [90, 0]]}
        stroke={"#2BA5A5"}
        lineWidth={2}
        y={0}
        x={0}
        opacity={0}
        end={0}
      />,
    );

    // Checkmark circle in middle
    const cdCheck = createRef();
    view.add(
      <Circle
        ref={cdCheck}
        width={40}
        height={40}
        stroke={"#2BA5A5"}
        lineWidth={2}
        y={0}
        x={0}
        opacity={0}
      />,
    );
    const cdCheckTxt = createRef();
    view.add(
      <Txt
        ref={cdCheckTxt}
        text="\u2713"
        fontSize={20}
        fill={"#2BA5A5"}
        y={0}
        x={0}
        opacity={0}
      />,
    );

    // Right circle
    const cdRightCircle = createRef();
    view.add(
      <Circle
        ref={cdRightCircle}
        width={140}
        height={140}
        stroke={"#2BA5A5"}
        lineWidth={3}
        y={0}
        x={160}
        opacity={0}
      />,
    );
    const cdRightLabel = createRef();
    view.add(
      <Txt
        ref={cdRightLabel}
        text={`AUTO
BOOKS`}
        fontSize={16}
        fontFamily={`Segoe UI, sans-serif`}
        fontWeight={600}
        fill={"#1a2332"}
        y={0}
        x={160}
        opacity={0}
        textAlign="center"
      />,
    );

    
    const cdSubtitle = createRef();
    view.add(
      <Txt
        ref={cdSubtitle}
        text={`Secure. Encrypted. Takes 60 seconds.`}
        fontSize={22}
        fontFamily={`Segoe UI, sans-serif`}
        fontWeight={400}
        fill={"#6B778C"}
        y={280}
        opacity={0}
        textAlign="center"
      />,
    );

    // Animate in
    yield* all(
      cdLogo().opacity(1, 0.3),
      cdHeading().opacity(1, 0.4, easeOutCubic),
    );
    yield* waitFor(0.2);

    // Left circle appears
    yield* all(
      cdLeftCircle().opacity(1, 0.3, easeOutCubic),
      cdLeftLabel().opacity(1, 0.3, easeOutCubic),
    );

    // Line draws
    yield* cdLine().opacity(1, 0.1);
    yield* cdLine().end(1, 0.5, easeOutCubic);

    // Checkmark pops
    yield* all(
      cdCheck().opacity(1, 0.2),
      cdCheckTxt().opacity(1, 0.2),
    );

    // Right circle appears
    yield* all(
      cdRightCircle().opacity(1, 0.3, easeOutCubic),
      cdRightLabel().opacity(1, 0.3, easeOutCubic),
    );

    yield* waitFor(0.2);
    yield* cdSubtitle().opacity(1, 0.4, easeOutCubic);

    yield* waitFor(0.3);

    // Fade out
    yield* all(
      cdLogo().opacity(0, 0.3),
      cdHeading().opacity(0, 0.3),
      cdLeftCircle().opacity(0, 0.3),
      cdLeftLabel().opacity(0, 0.3),
      cdLine().opacity(0, 0.3),
      cdCheck().opacity(0, 0.3),
      cdCheckTxt().opacity(0, 0.3),
      cdRightCircle().opacity(0, 0.3),
      cdRightLabel().opacity(0, 0.3),
      cdSubtitle().opacity(0, 0.3),
    );
    yield* waitFor(0.1);
  }


  // ─── TRANSACTION LIST SCENE ─────────────────────
  {
    const tlHeading = createRef();
    view.add(
      <Txt
        ref={tlHeading}
        text={`Auto-Categorize`}
        fontSize={42}
        fontFamily={`Georgia, serif`}
        fontWeight={700}
        fill={"#1a2332"}
        y={-380}
        opacity={0}
        textAlign="center"
      />,
    );


    // Transaction row 1
    const txRow0 = createRef();
    view.add(
      <Rect
        ref={txRow0}
        width={440}
        height={70}
        fill={"#f8f9fa"}
        radius={12}
        y={-250}
        opacity={0}
        layout
        direction="row"
        alignItems="center"
        padding={[0, 16]}
        gap={12}
      >
        <Rect width={44} height={44} fill={"#E3FCEF"} radius={10} />
        <Rect layout direction="column" gap={2} grow={1}>
          <Txt text={`Shopify Deposit`} fontSize={18} fontWeight={600} fill={"#1a2332"} fontFamily={`Segoe UI, sans-serif`} />
          <Txt text={`\u2192 Income`} fontSize={14} fill={"#6B778C"} fontFamily={`Segoe UI, sans-serif`} />
        </Rect>
        <Txt text={`+\$1,240`} fontSize={20} fontWeight={700} fill={"#22A06B"} fontFamily={`Segoe UI, sans-serif`} />
      </Rect>,
    );

    // Transaction row 2
    const txRow1 = createRef();
    view.add(
      <Rect
        ref={txRow1}
        width={440}
        height={70}
        fill={"#f8f9fa"}
        radius={12}
        y={-165}
        opacity={0}
        layout
        direction="row"
        alignItems="center"
        padding={[0, 16]}
        gap={12}
      >
        <Rect width={44} height={44} fill={"#FFEAEA"} radius={10} />
        <Rect layout direction="column" gap={2} grow={1}>
          <Txt text={`Adobe Creative`} fontSize={18} fontWeight={600} fill={"#1a2332"} fontFamily={`Segoe UI, sans-serif`} />
          <Txt text={`\u2192 Software`} fontSize={14} fill={"#6B778C"} fontFamily={`Segoe UI, sans-serif`} />
        </Rect>
        <Txt text={`-\$54.99`} fontSize={20} fontWeight={700} fill={"#DE350B"} fontFamily={`Segoe UI, sans-serif`} />
      </Rect>,
    );

    // Transaction row 3
    const txRow2 = createRef();
    view.add(
      <Rect
        ref={txRow2}
        width={440}
        height={70}
        fill={"#f8f9fa"}
        radius={12}
        y={-80}
        opacity={0}
        layout
        direction="row"
        alignItems="center"
        padding={[0, 16]}
        gap={12}
      >
        <Rect width={44} height={44} fill={"#E3FCEF"} radius={10} />
        <Rect layout direction="column" gap={2} grow={1}>
          <Txt text={`Client Wire`} fontSize={18} fontWeight={600} fill={"#1a2332"} fontFamily={`Segoe UI, sans-serif`} />
          <Txt text={`\u2192 Income`} fontSize={14} fill={"#6B778C"} fontFamily={`Segoe UI, sans-serif`} />
        </Rect>
        <Txt text={`+\$3,500`} fontSize={20} fontWeight={700} fill={"#22A06B"} fontFamily={`Segoe UI, sans-serif`} />
      </Rect>,
    );

    // Transaction row 4
    const txRow3 = createRef();
    view.add(
      <Rect
        ref={txRow3}
        width={440}
        height={70}
        fill={"#f8f9fa"}
        radius={12}
        y={5}
        opacity={0}
        layout
        direction="row"
        alignItems="center"
        padding={[0, 16]}
        gap={12}
      >
        <Rect width={44} height={44} fill={"#FFEAEA"} radius={10} />
        <Rect layout direction="column" gap={2} grow={1}>
          <Txt text={`Google Ads`} fontSize={18} fontWeight={600} fill={"#1a2332"} fontFamily={`Segoe UI, sans-serif`} />
          <Txt text={`\u2192 Marketing`} fontSize={14} fill={"#6B778C"} fontFamily={`Segoe UI, sans-serif`} />
        </Rect>
        <Txt text={`-\$420`} fontSize={20} fontWeight={700} fill={"#DE350B"} fontFamily={`Segoe UI, sans-serif`} />
      </Rect>,
    );

    // Transaction row 5
    const txRow4 = createRef();
    view.add(
      <Rect
        ref={txRow4}
        width={440}
        height={70}
        fill={"#f8f9fa"}
        radius={12}
        y={90}
        opacity={0}
        layout
        direction="row"
        alignItems="center"
        padding={[0, 16]}
        gap={12}
      >
        <Rect width={44} height={44} fill={"#FFEAEA"} radius={10} />
        <Rect layout direction="column" gap={2} grow={1}>
          <Txt text={`WeWork Rent`} fontSize={18} fontWeight={600} fill={"#1a2332"} fontFamily={`Segoe UI, sans-serif`} />
          <Txt text={`\u2192 Rent`} fontSize={14} fill={"#6B778C"} fontFamily={`Segoe UI, sans-serif`} />
        </Rect>
        <Txt text={`-\$800`} fontSize={20} fontWeight={700} fill={"#DE350B"} fontFamily={`Segoe UI, sans-serif`} />
      </Rect>,
    );

    // Transaction row 6
    const txRow5 = createRef();
    view.add(
      <Rect
        ref={txRow5}
        width={440}
        height={70}
        fill={"#f8f9fa"}
        radius={12}
        y={175}
        opacity={0}
        layout
        direction="row"
        alignItems="center"
        padding={[0, 16]}
        gap={12}
      >
        <Rect width={44} height={44} fill={"#E3FCEF"} radius={10} />
        <Rect layout direction="column" gap={2} grow={1}>
          <Txt text={`Stripe Payout`} fontSize={18} fontWeight={600} fill={"#1a2332"} fontFamily={`Segoe UI, sans-serif`} />
          <Txt text={`\u2192 Income`} fontSize={14} fill={"#6B778C"} fontFamily={`Segoe UI, sans-serif`} />
        </Rect>
        <Txt text={`+\$2,100`} fontSize={20} fontWeight={700} fill={"#22A06B"} fontFamily={`Segoe UI, sans-serif`} />
      </Rect>,
    );

    
    const tlSummary = createRef();
    view.add(
      <Txt
        ref={tlSummary}
        text={`\u2705 6 transactions sorted automatically`}
        fontSize={20}
        fontFamily={`Segoe UI, sans-serif`}
        fontWeight={500}
        fill={"#1a2332"}
        y={280}
        opacity={0}
        textAlign="center"
      />,
    );

    // Animate
    yield* tlHeading().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.2);

    // Staggered row reveal
    yield* txRow0().opacity(1, 0.2, easeOutCubic);
    yield* waitFor(0.08);
    yield* txRow1().opacity(1, 0.2, easeOutCubic);
    yield* waitFor(0.08);
    yield* txRow2().opacity(1, 0.2, easeOutCubic);
    yield* waitFor(0.08);
    yield* txRow3().opacity(1, 0.2, easeOutCubic);
    yield* waitFor(0.08);
    yield* txRow4().opacity(1, 0.2, easeOutCubic);
    yield* waitFor(0.08);
    yield* txRow5().opacity(1, 0.2, easeOutCubic);
    yield* waitFor(0.08);

    
    yield* waitFor(0.2);
    yield* tlSummary().opacity(1, 0.3, easeOutCubic);

    yield* waitFor(0.3);

    yield* all(
      tlHeading().opacity(0, 0.3),
      txRow0().opacity(0, 0.3),
      txRow1().opacity(0, 0.3),
      txRow2().opacity(0, 0.3),
      txRow3().opacity(0, 0.3),
      txRow4().opacity(0, 0.3),
      txRow5().opacity(0, 0.3),
      tlSummary().opacity(0, 0.3),
    );
    yield* waitFor(0.1);
  }


  // ─── REPORT CARD SCENE ──────────────────────────
  {
    const rpHeading = createRef();
    view.add(
      <Txt ref={rpHeading} text={`Reports generate for you`} fontSize={40} fontWeight={700} fill={"#1a2332"} y={-420} opacity={0} textAlign="center" fontFamily={`Georgia, serif`} />
    );

    const rpTitle = createRef();
    view.add(
      <Txt ref={rpTitle} text={`Profit & Loss`} fontSize={24} fontWeight={600} fill={"#2BA5A5"} y={-340} x={-140} opacity={0} fontFamily={`Segoe UI, sans-serif`} />
    );
    const rpPeriod = createRef();
    view.add(
      <Txt ref={rpPeriod} text={`April 2026`} fontSize={18} fill={"#6B778C"} y={-340} x={140} opacity={0} fontFamily={`Segoe UI, sans-serif`} textAlign="right" />
    );

    // Card background
    const rpCard = createRef();
    view.add(
      <Rect ref={rpCard} width={460} height={256} fill={"#f8faf8"} radius={16} y={-22} opacity={0} stroke={"#2BA5A530"} lineWidth={2} />
    );


    const rpSec0 = createRef();
    view.add(
      <Txt ref={rpSec0} text={`Revenue`} fontSize={20} fontWeight={700} fill={"#1a2332"} y={-200} x={-140} opacity={0} fontFamily={`Segoe UI, sans-serif`} />
    );
    const rpRow1L = createRef();
    const rpRow1V = createRef();
    view.add(<Txt ref={rpRow1L} text={`Product Sales`} fontSize={18} fill={"#1a2332"} y={-158} x={-140} opacity={0} fontFamily={`Segoe UI, sans-serif`} />);
    view.add(<Txt ref={rpRow1V} text={`\$18,400`} fontSize={18} fill={"#1a2332"} y={-158} x={140} opacity={0} fontFamily={`Segoe UI, sans-serif`} textAlign="right" />);
    const rpRow2L = createRef();
    const rpRow2V = createRef();
    view.add(<Txt ref={rpRow2L} text={`Service Income`} fontSize={18} fill={"#1a2332"} y={-122} x={-140} opacity={0} fontFamily={`Segoe UI, sans-serif`} />);
    view.add(<Txt ref={rpRow2V} text={`\$6,180`} fontSize={18} fill={"#1a2332"} y={-122} x={140} opacity={0} fontFamily={`Segoe UI, sans-serif`} textAlign="right" />);
    const rpTot3L = createRef();
    const rpTot3V = createRef();
    view.add(<Txt ref={rpTot3L} text={`Total Revenue`} fontSize={20} fontWeight={700} fill={"#1a2332"} y={-86} x={-140} opacity={0} fontFamily={`Segoe UI, sans-serif`} />);
    view.add(<Txt ref={rpTot3V} text={`\$24,580`} fontSize={20} fontWeight={700} fill={"#22A06B"} y={-86} x={140} opacity={0} fontFamily={`Segoe UI, sans-serif`} textAlign="right" />);
    const rpSec4 = createRef();
    view.add(
      <Txt ref={rpSec4} text={`Expenses`} fontSize={20} fontWeight={700} fill={"#1a2332"} y={-40} x={-140} opacity={0} fontFamily={`Segoe UI, sans-serif`} />
    );
    const rpRow5L = createRef();
    const rpRow5V = createRef();
    view.add(<Txt ref={rpRow5L} text={`Software & Tools`} fontSize={18} fill={"#1a2332"} y={2} x={-140} opacity={0} fontFamily={`Segoe UI, sans-serif`} />);
    view.add(<Txt ref={rpRow5V} text={`\$2,340`} fontSize={18} fill={"#1a2332"} y={2} x={140} opacity={0} fontFamily={`Segoe UI, sans-serif`} textAlign="right" />);
    const rpRow6L = createRef();
    const rpRow6V = createRef();
    view.add(<Txt ref={rpRow6L} text={`Marketing`} fontSize={18} fill={"#1a2332"} y={38} x={-140} opacity={0} fontFamily={`Segoe UI, sans-serif`} />);
    view.add(<Txt ref={rpRow6V} text={`\$1,870`} fontSize={18} fill={"#1a2332"} y={38} x={140} opacity={0} fontFamily={`Segoe UI, sans-serif`} textAlign="right" />);
    const rpRow7L = createRef();
    const rpRow7V = createRef();
    view.add(<Txt ref={rpRow7L} text={`Rent & Utilities`} fontSize={18} fill={"#1a2332"} y={74} x={-140} opacity={0} fontFamily={`Segoe UI, sans-serif`} />);
    view.add(<Txt ref={rpRow7V} text={`\$3,420`} fontSize={18} fill={"#1a2332"} y={74} x={140} opacity={0} fontFamily={`Segoe UI, sans-serif`} textAlign="right" />);
    const rpTot8L = createRef();
    const rpTot8V = createRef();
    view.add(<Txt ref={rpTot8L} text={`Total Expenses`} fontSize={20} fontWeight={700} fill={"#1a2332"} y={110} x={-140} opacity={0} fontFamily={`Segoe UI, sans-serif`} />);
    view.add(<Txt ref={rpTot8V} text={`\$7,620`} fontSize={20} fontWeight={700} fill={"#DE350B"} y={110} x={140} opacity={0} fontFamily={`Segoe UI, sans-serif`} textAlign="right" />);

    const rpBottomBg = createRef();
    view.add(<Rect ref={rpBottomBg} width={420} height={50} fill={"#2BA5A515"} radius={8} y={166} opacity={0} />);
    const rpBottomL = createRef();
    view.add(<Txt ref={rpBottomL} text={`Net Profit`} fontSize={22} fontWeight={700} fill={"#22A06B"} y={166} x={-140} opacity={0} fontFamily={`Segoe UI, sans-serif`} />);
    const rpBottomV = createRef();
    view.add(<Txt ref={rpBottomV} text={`\$16,950`} fontSize={26} fontWeight={700} fill={"#22A06B"} y={166} x={140} opacity={0} fontFamily={`Segoe UI, sans-serif`} textAlign="right" />);

    
    const rpFooter = createRef();
    view.add(<Txt ref={rpFooter} text={`Auto-generated - zero manual entry`} fontSize={16} fill={"#6B778C"} y={236} opacity={0} textAlign="center" fontFamily={`Segoe UI, sans-serif`} />);

    // Animate
    yield* rpHeading().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.15);
    yield* rpCard().opacity(1, 0.2);
    yield* all(rpTitle().opacity(1, 0.2), rpPeriod().opacity(1, 0.2));
    yield* waitFor(0.1);

    yield* rpSec0().opacity(1, 0.15);
    yield* all(rpRow1L().opacity(1, 0.1), rpRow1V().opacity(1, 0.1));
    yield* all(rpRow2L().opacity(1, 0.1), rpRow2V().opacity(1, 0.1));
    yield* all(rpTot3L().opacity(1, 0.15), rpTot3V().opacity(1, 0.15));
    yield* rpSec4().opacity(1, 0.15);
    yield* all(rpRow5L().opacity(1, 0.1), rpRow5V().opacity(1, 0.1));
    yield* all(rpRow6L().opacity(1, 0.1), rpRow6V().opacity(1, 0.1));
    yield* all(rpRow7L().opacity(1, 0.1), rpRow7V().opacity(1, 0.1));
    yield* all(rpTot8L().opacity(1, 0.15), rpTot8V().opacity(1, 0.15));


    yield* all(
      rpBottomBg().opacity(1, 0.2),
      rpBottomL().opacity(1, 0.2),
      rpBottomV().opacity(1, 0.2),
    );

    yield* waitFor(0.1);
    yield* rpFooter().opacity(1, 0.3);

    yield* waitFor(0.3);

    yield* all(
      rpHeading().opacity(0, 0.3),
      rpCard().opacity(0, 0.3),
      rpTitle().opacity(0, 0.3),
      rpPeriod().opacity(0, 0.3),
      rpSec0().opacity(0, 0.3),
      rpRow1().opacity(0, 0.3),
      rpRow1L().opacity(0, 0.3),
      rpRow1V().opacity(0, 0.3),
      rpRow2().opacity(0, 0.3),
      rpRow2L().opacity(0, 0.3),
      rpRow2V().opacity(0, 0.3),
      rpTot3L().opacity(0, 0.3),
      rpTot3V().opacity(0, 0.3),
      rpSec4().opacity(0, 0.3),
      rpRow5().opacity(0, 0.3),
      rpRow5L().opacity(0, 0.3),
      rpRow5V().opacity(0, 0.3),
      rpRow6().opacity(0, 0.3),
      rpRow6L().opacity(0, 0.3),
      rpRow6V().opacity(0, 0.3),
      rpRow7().opacity(0, 0.3),
      rpRow7L().opacity(0, 0.3),
      rpRow7V().opacity(0, 0.3),
      rpTot8L().opacity(0, 0.3),
      rpTot8V().opacity(0, 0.3),
      rpBottomBg().opacity(0, 0.3),
      rpBottomL().opacity(0, 0.3),
      rpBottomV().opacity(0, 0.3),
      rpFooter().opacity(0, 0.3),
    );
    yield* waitFor(0.1);
  }


  // ─── LINE CHART SCENE ──────────────────────────
  {
    const lcHeading = createRef();
    view.add(
      <Txt ref={lcHeading} text={`Cash Flow Forecast`} fontSize={40} fontWeight={700} fill={"#1a2332"} y={-380} opacity={0} textAlign="center" fontFamily={`Georgia, serif`} />
    );

    // Chart card background
    const lcCard = createRef();
    view.add(
      <Rect ref={lcCard} width={460} height={320} fill={"#ffffff"} radius={16} y={-20} opacity={0} stroke={"#e0e0e0"} lineWidth={1} />
    );

    // X-axis labels (static)

    view.add(
      <Txt text={`Jan`} fontSize={14} fill={"#6B778C"} x={-210} y={134} fontFamily={`Segoe UI, sans-serif`} />,
    );
    view.add(
      <Txt text={`Feb`} fontSize={14} fill={"#6B778C"} x={-140} y={134} fontFamily={`Segoe UI, sans-serif`} />,
    );
    view.add(
      <Txt text={`Mar`} fontSize={14} fill={"#6B778C"} x={-70} y={134} fontFamily={`Segoe UI, sans-serif`} />,
    );
    view.add(
      <Txt text={`Apr`} fontSize={14} fill={"#6B778C"} x={0} y={134} fontFamily={`Segoe UI, sans-serif`} />,
    );
    view.add(
      <Txt text={`May`} fontSize={14} fill={"#6B778C"} x={70} y={134} fontFamily={`Segoe UI, sans-serif`} />,
    );
    view.add(
      <Txt text={`Jun`} fontSize={14} fill={"#6B778C"} x={140} y={134} fontFamily={`Segoe UI, sans-serif`} />,
    );
    view.add(
      <Txt text={`Jul`} fontSize={14} fill={"#6B778C"} x={210} y={134} fontFamily={`Segoe UI, sans-serif`} />,
    );

    // Actual data line
    const lcActualLine = createRef();
    view.add(
      <Line
        ref={lcActualLine}
        points={[[-210, 121], [-140, 85], [-70, 96], [0, 60], [70, 27]]}
        stroke={"#2BA5A5"}
        lineWidth={3}
        y={-20}
        opacity={0}
        end={0}
        lineJoin="round"
      />,
    );

    
    // Forecast line (dashed)
    const lcForecastLine = createRef();
    view.add(
      <Line
        ref={lcForecastLine}
        points={[[70, 27], [140, -13], [210, -70]]}
        stroke={"#2BA5A580"}
        lineWidth={2}
        lineDash={[8, 6]}
        y={-20}
        opacity={0}
        end={0}
        lineJoin="round"
      />,
    );

    // Forecast area fill
    const lcForecastArea = createRef();
    view.add(
      <Rect
        ref={lcForecastArea}
        width={140}
        height={260}
        fill={"#2BA5A515"}
        x={140}
        y={-20}
        opacity={0}
        radius={4}
      />,
    );

    // Data point circles

    const lcDot0 = createRef();
    view.add(
      <Circle ref={lcDot0} width={12} height={12} fill={"#2BA5A5"} x={-210} y={101} opacity={0} />,
    );
    const lcDot1 = createRef();
    view.add(
      <Circle ref={lcDot1} width={12} height={12} fill={"#2BA5A5"} x={-140} y={65} opacity={0} />,
    );
    const lcDot2 = createRef();
    view.add(
      <Circle ref={lcDot2} width={12} height={12} fill={"#2BA5A5"} x={-70} y={76} opacity={0} />,
    );
    const lcDot3 = createRef();
    view.add(
      <Circle ref={lcDot3} width={12} height={12} fill={"#2BA5A5"} x={0} y={40} opacity={0} />,
    );
    const lcDot4 = createRef();
    view.add(
      <Circle ref={lcDot4} width={12} height={12} fill={"#2BA5A5"} x={70} y={7} opacity={0} />,
    );
    const lcDot5 = createRef();
    view.add(
      <Circle ref={lcDot5} width={12} height={12} fill={"#2BA5A5"} x={140} y={-33} opacity={0} />,
    );
    const lcDot6 = createRef();
    view.add(
      <Circle ref={lcDot6} width={12} height={12} fill={"#2BA5A5"} x={210} y={-90} opacity={0} />,
    );


    const lcSum0 = createRef();
    view.add(
      <Rect ref={lcSum0} width={180} height={70} fill={"#2BA5A512"} radius={16} y={210} x={-120} opacity={0} layout direction="column" alignItems="center" justifyContent="center" gap={4}>
        <Txt text={`Current`} fontSize={14} fill={"#6B778C"} fontFamily={`Segoe UI, sans-serif`} />
        <Txt text={`\$16,950`} fontSize={24} fontWeight={700} fill={"#22A06B"} fontFamily={`Segoe UI, sans-serif`} />
      </Rect>,
    );
    const lcSum1 = createRef();
    view.add(
      <Rect ref={lcSum1} width={180} height={70} fill={"#2BA5A512"} radius={16} y={210} x={120} opacity={0} layout direction="column" alignItems="center" justifyContent="center" gap={4}>
        <Txt text={`Forecast`} fontSize={14} fill={"#6B778C"} fontFamily={`Segoe UI, sans-serif`} />
        <Txt text={`\$22,400`} fontSize={24} fontWeight={700} fill={"#22A06B"} fontFamily={`Segoe UI, sans-serif`} />
      </Rect>,
    );

    // Animate
    yield* lcHeading().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.15);
    yield* lcCard().opacity(1, 0.2);

    // Draw actual line
    yield* lcActualLine().opacity(1, 0.1);
    yield* lcActualLine().end(1, 1.0, easeOutCubic);

    // Show data point circles
    yield* all(
      lcDot0().opacity(1, 0.1),
      lcDot1().opacity(1, 0.1),
      lcDot2().opacity(1, 0.1),
      lcDot3().opacity(1, 0.1),
      lcDot4().opacity(1, 0.1),
      lcDot5().opacity(1, 0.1),
      lcDot6().opacity(1, 0.1),
    );

    
    // Show forecast area, then draw forecast line
    yield* lcForecastArea().opacity(1, 0.3, easeOutCubic);
    yield* lcForecastLine().opacity(1, 0.1);
    yield* lcForecastLine().end(1, 0.6, easeOutCubic);

    
    yield* waitFor(0.2);
    yield* all(
      lcSum0().opacity(1, 0.3),
      lcSum1().opacity(1, 0.3),
    );

    yield* waitFor(0.3);

    // Fade out
    yield* all(
      lcHeading().opacity(0, 0.3),
      lcCard().opacity(0, 0.3),
      lcActualLine().opacity(0, 0.2),
      lcForecastLine().opacity(0, 0.2),
      lcForecastArea().opacity(0, 0.2),
      lcDot0().opacity(0, 0.2),
      lcDot1().opacity(0, 0.2),
      lcDot2().opacity(0, 0.2),
      lcDot3().opacity(0, 0.2),
      lcDot4().opacity(0, 0.2),
      lcDot5().opacity(0, 0.2),
      lcDot6().opacity(0, 0.2),
      lcSum0().opacity(0, 0.2),
      lcSum1().opacity(0, 0.2),
    );
    yield* waitFor(0.1);
  }


  // ─── CTA END CARD ──────────────────────────────
  {
    // Large icon placeholder
    const ctaIcon = createRef();
    view.add(
      <Rect
        ref={ctaIcon}
        width={120}
        height={120}
        fill={"#2BA5A5"}
        radius={28}
        y={-250}
        opacity={0}
      />,
    );

    const ctaBrand = createRef();
    view.add(
      <Txt
        ref={ctaBrand}
        text={`AUTOBOOKS`}
        fontSize={22}
        fontFamily={`Segoe UI, sans-serif`}
        fontWeight={600}
        letterSpacing={4}
        fill={"#2BA5A5"}
        y={-150}
        opacity={0}
      />,
    );

    const ctaHeading = createRef();
    view.add(
      <Txt
        ref={ctaHeading}
        text={`Start free.`}
        fontSize={64}
        fontFamily={`Georgia, serif`}
        fontWeight={400}
        fill={"#1a2332"}
        y={-30}
        opacity={0}
        textAlign="center"
      />,
    );

    // Button pill
    const ctaButton = createRef();
    view.add(
      <Rect
        ref={ctaButton}
        width={360}
        height={64}
        fill={"#2BA5A5"}
        radius={32}
        y={100}
        opacity={0}
        layout
        alignItems="center"
        justifyContent="center"
      >
        <Txt
          text={`getautobooks.com`}
          fontSize={24}
          fontWeight={600}
          fill={"#ffffff"}
          fontFamily={`Segoe UI, sans-serif`}
        />
      </Rect>,
    );

    
    const ctaFootnote = createRef();
    view.add(
      <Txt
        ref={ctaFootnote}
        text={`No credit card required - Setup in 2 min`}
        fontSize={18}
        fontFamily={`Segoe UI, sans-serif`}
        fontWeight={400}
        fill={"#6B778C"}
        y={220}
        opacity={0}
        textAlign="center"
      />,
    );

    // Animate in
    yield* ctaIcon().opacity(1, 0.4, easeOutCubic);
    yield* waitFor(0.1);
    yield* ctaBrand().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.1);
    yield* ctaHeading().opacity(1, 0.4, easeOutCubic);
    yield* waitFor(0.15);
    yield* ctaButton().opacity(1, 0.3, easeOutCubic);
    
    yield* waitFor(0.1);
    yield* ctaFootnote().opacity(1, 0.3, easeOutCubic);

    // Hold until end
    yield* waitFor(0.3);
  }
});

export default makeProject({
  scenes: [marketingReel],
  settings: {
    size: { x: 1080, y: 1920 },
    fps: 30,
    background: '#FFFFFF',
  },
});
