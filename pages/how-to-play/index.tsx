import { useRouter } from "next/router";
import { Button } from "../../components/button";
import { ContentBox } from "../../components/contentBox";
import { FooterButtons } from "../../components/footerButtons";

export default function Page() {
    const router = useRouter();

    return (
        <div className='center'>
            <ContentBox >
                <h1>CELLULAR ENERGY</h1><br />
                <p>CELLULAR ENERGY is a game of cell <b>evolution</b>.</p>
                <p>
                    The goal of the game is to ensure your team's cells occupy the majoroity of the board every evolution. If your team wins, you win ETH.
                </p>
            </ContentBox>
            <FooterButtons>
                <Button onClick={() => { router.push('/') }}>Go Back</Button>
                <Button onClick={() => { router.push('/how-to-play/teams') }}>
                    Continue
                </Button>
            </FooterButtons>
        </div>
    )
}
