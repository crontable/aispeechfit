import ReversibleCard from '@/components/ReversibleCard';
import { ConditionalSidebarToggle } from '@/components/conditional-sidebar-toggle';
import { convertToReversibleCardQuestions } from '@/lib/converter';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

const DUMMY_DATA = [
  {
    "id": "physiology",
    "label": "운동생리학",
    "questions": [
      {
        "id": 1001,
        "question": "ATP에 대해 설명하세요",
        "similarQuestions": [
          "ATP-PC 시스템을 설명하세요.",
          "인원질 시스템에 대해 설명하세요.",
          "젖산이 생기는 이유에 대해 설명하세요."
        ],
        "answer": "<strong>ATP</strong>는<ol>  <li><strong class=\"keyword\">인체의 주요 에너지원</strong>으로 정의할 수 있습니다.</li>  <li><strong class=\"keyword\">아데노신과 세 개의 인산</strong>으로 구성됩니다.</li>  <li><strong class=\"keyword\">고에너지 인산 결합</strong>이 끊어질 때 <strong class=\"keyword\">ADP와 무기 인산</strong>으로 분해되며 에너지가 발생합니다.</li>  <li><strong class=\"keyword\">세포 호흡 과정</strong>을 통해 ATP가 재생성되며, <strong class=\"keyword\">운동 시 근육 수축</strong>에 사용됩니다.</li></ol><br /><h3 class=\"subtitle\">이전 답변</h3>도대체 어떤 답변이 더 좋은지 잘 모르겠음<br /><ol>   <li><strong class=\"keyword\">ATP</strong>는 아데노신과 세 개의 인산으로 구성되며 <strong class=\"keyword\">즉각적으로 사용될 수 있는</strong> 인체의 주요 <strong class=\"keyword\">에너지원</strong>입니다.</li>   <li><strong class=\"keyword\">탄수화물, 지방, 단백질</strong>을 대사하여 ATP를 생산하며, ATP가 ADP와 무기 인산으로 분해될 때 에너지가 발생합니다.</li>   <li>운동 시 근육 수축 과정은 이 에너지를 통해 이루어지며, <strong class=\"keyword\">세포 호흡</strong>을 통해 ATP가 재생성됩니다.</li></ol><br /><br /><h3 class=\"subtitle\">예시</h3>예를 들어, 운동할 때 근육이 수축할 때 ATP가 분해되면서 에너지가 생성됩니다. 또한, 세포 호흡 과정을 통해 ATP가 재생성되어지속적으로 에너지를 공급하게 됩니다.",
        "keyword": [
          "ATP"
        ],
        "mainKeyword": [
          "인체의 주요 에너지원",
          "아데노신과 세 개의 인산",
          "고에너지 인산 결합",
          "ADP와 무기 인산",
          "세포 호흡 과정",
          "운동 시 근육 수축",
          "ATP",
          "즉각적으로 사용될 수 있는",
          "에너지원",
          "탄수화물, 지방, 단백질",
          "세포 호흡"
        ],
        "scores": {
          "chatgpt_4o": 20,
          "claude_opus": 20
        },
        "priority": "",
        "audio": {
          "question": "https://onedrive.live.com/download?resid=B826510AEFA2D645%21163&authkey=!AAna2nCbu7CRJO4",
          "answer": "https://onedrive.live.com/download?resid=B826510AEFA2D645%21144&authkey=!ANuZYoYDxzPom60"
        }
      },
      {
        "id": 1002,
        "question": "에너지 시스템에 대해 설명하세요.",
        "similarQuestions": [],
        "answer": "<strong>1. ATP-PC 시스템(인원질 시스템)</strong>: <strong class=\"keyword\">10초 내외로 사용되는 최초의 에너지 시스템</strong>으로 <strong class=\"keyword\">근육에 저장되어 있는 ATP를 빠르게 끌어내 에너지를 공급</strong>합니다. <br /><br /><strong>2. 해당작용 시스템(젖산시스템)</strong>: <strong class=\"keyword\">포도당을 이용</strong>해서 에너지를 생산하는 시스템으로 포도당은 해당 과정을 거쳐 피루브산으로 분해되면서 에너지를 생성하는데 <strong class=\"keyword\">이 과정에서 산소가 불충분하면 피루브산이 젖산으로 전환</strong>됩니다. <br /><br /><strong>3. 유산소 시스템</strong>: <strong class=\"keyword\">산소를 이용하여 에너지를 만드는 시스템</strong>입니다. <strong class=\"keyword\">크렙스 회로나 전자 전달계</strong>를 거쳐 에너지가 생성됩니다. 이때 젖산의 축적을 막으면서 ATP를 생성해 장시간 운동에 사용됩니다.",
        "keyword": [
          "1. ATP-PC 시스템(인원질 시스템)",
          "2. 해당작용 시스템(젖산시스템)",
          "3. 유산소 시스템"
        ],
        "mainKeyword": [
          "10초 내외로 사용되는 최초의 에너지 시스템",
          "근육에 저장되어 있는 ATP를 빠르게 끌어내 에너지를 공급",
          "포도당을 이용",
          "이 과정에서 산소가 불충분하면 피루브산이 젖산으로 전환",
          "산소를 이용하여 에너지를 만드는 시스템",
          "크렙스 회로나 전자 전달계"
        ],
        "scores": {
          "chatgpt_4o": 19,
          "claude_opus": null
        },
        "priority": "",
        "audio": {
          "question": "https://onedrive.live.com/download?resid=B826510AEFA2D645%21164&authkey=!AOOVWnaTAAch7AM",
          "answer": "https://onedrive.live.com/download?resid=B826510AEFA2D645%21145&authkey=!ACegi9Vm9oK32kk"
        }
      },
    ]
  }
] 


export default async function ProtectedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/sign-in');
  }

  // DUMMY_DATA를 ReversibleCard 컴포넌트에 맞는 형식으로 변환
  const convertedQuestions = convertToReversibleCardQuestions(DUMMY_DATA[0].questions);

  return (
    <div className="flex-1 w-full flex flex-col">
      <div className="flex justify-between items-center h-40px">
        <div className="flex items-center gap-2">
          <ConditionalSidebarToggle />
          <h1 className='text-xl'>구술 카드</h1>
        </div>
      </div>
      <div className="w-full">
        <ReversibleCard questions={convertedQuestions} />
      </div>
    </div>
  );
}
