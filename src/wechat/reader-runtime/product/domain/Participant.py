from dataclasses import dataclass

from .ids import ParticipantId


@dataclass(frozen=True)
class Participant:
    id: ParticipantId             # 内部稳定 ID
    displayName: str              # 昵称
    isSelf: bool = False
    inAddressBook: bool = True    # 是否在本机通讯录（影响昵称可得性）
