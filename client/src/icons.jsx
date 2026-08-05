// Icônes via la police "Material Icons" (chargée dans index.html) — évite la
// dépendance lourde @mui/icons-material. Même API : <XIcon /> renvoie une icône.
import Icon from '@mui/material/Icon';

const make = (name) => function I(props) { return <Icon {...props}>{name}</Icon>; };

export const DashboardIcon = make('space_dashboard');
export const FolderIcon = make('folder');
export const GroupIcon = make('group');
export const HistoryIcon = make('history');
export const PersonIcon = make('account_circle');
export const LockIcon = make('lock');
export const Visibility = make('visibility');
export const VisibilityOff = make('visibility_off');
export const DescriptionIcon = make('description');
export const EventBusyIcon = make('event_busy');
export const ShareIcon = make('share');
export const SearchIcon = make('search');
export const AddIcon = make('add');
export const ImageIcon = make('image');
export const PictureAsPdfIcon = make('picture_as_pdf');
export const UploadFileIcon = make('upload_file');
export const ArrowBackIcon = make('arrow_back');
export const DownloadIcon = make('download');
export const DeleteIcon = make('delete');
export const VisibilityIcon = make('visibility');
export const PersonAddIcon = make('person_add');
export const MoreVertIcon = make('more_vert');
export const LogoutIcon = make('logout');
export const ArchiveIcon = make('archive');
export const UnarchiveIcon = make('unarchive');
export const StarIcon = make('star');
export const StarBorderIcon = make('star_border');
export const TuneIcon = make('tune');
export const CloseIcon = make('close');
