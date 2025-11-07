import { Typography, Flex, IconButton } from '@maxhub/max-ui';
import { Share2, Filter } from 'lucide-react';

interface TasksHeaderProps {
    formattedDate: string;
    onShare: () => void;
    onOpenFilters: () => void;
}

export const TasksHeader = ({ formattedDate, onShare, onOpenFilters }: TasksHeaderProps) => {
    return (
        <>
            <Flex
                direction="row"
                gap={12}
                style={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                }}
            >
                <Typography.Headline>Сегодня</Typography.Headline>
                <Flex direction="row" gap={8}>
                    <IconButton onClick={onShare}>
                        <Share2 size={24} />
                    </IconButton>
                    <IconButton onClick={onOpenFilters}>
                        <Filter size={24} />
                    </IconButton>
                </Flex>
            </Flex>

            <Typography.Body style={{ marginBottom: '24px', color: '#6B7280' }}>
                {formattedDate}
            </Typography.Body>
        </>
    );
};